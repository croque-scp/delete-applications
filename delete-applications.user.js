/*
Wikidot applications deleter userscript

For installation instructions, see https://scpwiki.com/usertools
*/

// ==UserScript==
// @name        Wikidot applications deleter
// @description Adds a button to delete applications from your Wikidot inbox.
// @version     v1.0.1
// @updateURL   https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js
// @downloadURL https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js
// @include     https://www.wikidot.com/account/messages*
// ==/UserScript==

let deleteButtonsContainer

const deleterDebug = log => console.debug("Applications deleter:", log)

class Message {
  constructor(messageElement) {
    this.selector = messageElement.querySelector("input[type=checkbox]")
    this.id = this.selector.value

    // Extract the sender and the subject
    const from = messageElement.querySelector("td span.from span.printuser")
    this.fromWikidot = (
      !from.classList.contains("avatarhover") && from.innerText === "Wikidot"
    )
    this.subject = messageElement.querySelector("span.subject").innerText

    // Is this message an application?
    this.isApplication = (
      this.fromWikidot
      && this.subject === "You received a membership application"
    )
  }

  select() { this.selector.checked = true }
  deselect() { this.selector.checked = false }
  get isSelected() { return this.selector.checked }
}

async function deleteApplications(deleteAll = false) {
  const applicationIds = []
  const messageElement = document.getElementById("message-area")

  let goToNextPage = true

  firstPage(messageElement)

  do {
    const messages = getMessagesOnPage()

    // If no messages are selected, select all messages
    if (countSelected(messages) === 0) {
      messages.forEach(message => message.select())
    }

    // Deselect all messages that are not applications
    messages.forEach(message => {
      if (!message.isApplication) message.deselect()
    })

    // Save the IDs of all selected messages
    const selectedMessages = messages
      .filter(message => message.isSelected)
      .map(message => message.id)
    deleterDebug(`Found ${selectedMessages.length} applications`)
    applicationIds.push(selectedMessages)

    // If there were no selected messages, and we are only deleting recent
    // messages (i.e. deleteAll is false), don't go to the next page
    if (selectedMessages.length === 0 && !deleteAll) goToNextPage = false

    if (goToNextPage) await nextPage(messageElement)
  } while (goToNextPage)

  // Delete all saved messages
  deleteMessages(applicationIds.flat())

  firstPage(messageElement)
}

function getMessagesOnPage() {
  return Array.from(
    document.querySelectorAll("tr.message")
  ).map(el => new Message(el))
}

function countSelected(messages) {
  return messages.reduce((a, b) => a + b.isSelected, 0)
}

function deleteMessages(ids) {
  // Produce a confirmation modal with the number of applications to delete
  const confirmModal = new OZONE.dialogs.ConfirmationDialog()
  confirmModal.content = `Delete ${ids.length} applications?`
  confirmModal.buttons = ["cancel", "delete applications"]
  confirmModal.addButtonListener("cancel", confirmModal.close)
  confirmModal.addButtonListener("delete applications", () => {
    const request = {
      action: "DashboardMessageAction",
      event: "removeMessages",
      messages: ids
    }
    OZONE.ajax.requestModule(null, request, () => {
      const successModal = new OZONE.dialogs.SuccessBox()
      successModal.content = "Deleted applications."
      successModal.show()
      WIKIDOT.modules.DashboardMessagesModule.app.refresh()
    })
  })
  confirmModal.focusButton = "cancel"
  confirmModal.show()
}

function shouldShowDeleteButtons(hash) {
  return ["", "#/inbox"].includes(hash)
}

function toggleDeleteButtons() {
  deleteButtonsContainer.style.display =
    shouldShowDeleteButtons(location.hash) ? "" : "none"
}

async function firstPage(messageElement) {
  deleterDebug("Going to first page")
  const pager = messageElement.querySelector(".pager")
  if (pager == null) return
  const currentPageButton = pager.querySelector(".current")
  if (currentPageButton == null) return
  if (currentPageButton.textContent.trim() === "1") return

  // The first page button should always be visible
  const firstPageButton = pager.querySelector(".target [href='#/inbox/p1']")
  if (firstPageButton == null) return

  // Click the button and return once the page has reloaded
  await new Promise(resolve => {
    const observer = new MutationObserver(() => {
      observer.disconnect()
      resolve()
    })
    observer.observe(messageElement, { childList: true })

    firstPageButton.click()
  })
  return true
}

/**
 * Iterate the next page of messages.
 * 
 * Returns false if this is the last page, otherwise returns true after the
 * page has loaded.
 */
async function nextPage(messageElement) {
  deleterDebug("Going to next page")
  const pager = messageElement.querySelector(".pager")
  if (pager == null) return false
  const nextButton = pager.querySelector(".target:last-child a")
  if (nextButton == null) return false
  if (nextButton.textContent.trim() !== "next »") return false

  // Wait until the next page has finished loading
  await new Promise(resolve => {
    const observer = new MutationObserver(() => {
      observer.disconnect()
      resolve()
    })
    observer.observe(messageElement, { childList: true })

    nextButton.click()
  })
  return true
}

addEventListener("load", () => {
  // Create the buttons
  const deletePageButton = document.createElement("button")
  deletePageButton.innerText = "Delete applications on page"
  deletePageButton.classList.add("red", "btn", "btn-xs", "btn-danger")
  deletePageButton.title = `
    Delete selected applications.
    If no applications are selected, delete all applications on current page.
  `.replace(/\s+/g, " ")
  deletePageButton.addEventListener("click", () => deleteApplications(false))

  const deleteAllButton = document.createElement("button")
  deleteAllButton.innerText = "Delete all applications"
  deleteAllButton.classList.add("red", "btn", "btn-xs", "btn-danger")
  deleteAllButton.title = `
    Delete all applications in your inbox.
    May take a while if you have a lot.
  `.replace(/\s+/g, " ")
  deleteAllButton.addEventListener("click", () => deleteApplications(true))

  deleteButtonsContainer = document.createElement("div")
  deleteButtonsContainer.style.textAlign = "right"
  deleteButtonsContainer.append(deletePageButton, " ", deleteAllButton)
  toggleDeleteButtons()

  const buttonLocation = document.getElementById("message-area").parentElement
  buttonLocation.prepend(deleteButtonsContainer)
})

// Detect clicks to messages and inbox tabs and hide/show buttons as appropriate
addEventListener("click", () => {
  setTimeout(() => {
    toggleDeleteButtons()
  }, 500)
})