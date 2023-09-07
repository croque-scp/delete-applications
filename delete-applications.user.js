/*
Wikidot applications deleter userscript

For installation instructions, see https://scpwiki.com/usertools
*/

/* CHANGELOG

v1.3.0
- Added changelog.

v1.2.0 (2023-07-07)
- Added a list of sites to the deletion confirmation popup that tells you which Wikidot sites the applications come from, and how many there are per site.

v1.1.0 (2022-04-11)
- Added new feature 'delete recent applications' that deletes applications page-by-page until encountering a page with no applications.
- Removed feature 'delete applications on current page'.
- After scanning pages of messages, script now puts you back on the first page instead of leaving you wherever it stopped.
- The delete buttons are now visible on all pages of the inbox instead of just the first.

v1.0.1 (2022-03-06)
- Hid buttons when reading a message.
- Fixed deletion confirmation popup interfering with message composer UI.

v1.0.0 (2022-03-01)
- Created userscript.
*/

// ==UserScript==
// @name        Wikidot applications deleter
// @description Adds a button to delete applications from your Wikidot inbox.
// @author      Croquembouche
// @version     v1.2.0
// @updateURL   https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js
// @downloadURL https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js
// @supportURL  https://www.wikidot.com/account/messages#/new/2893766
// @match       https://www.wikidot.com/account/messages*
// ==/UserScript==

/* global WIKIDOT, OZONE */

let deleteButtonsContainer

const deleterDebug = log => console.debug("Applications deleter:", log)

/**
 * Collates details about a message based on its little preview.
 */
class Message {
  constructor(messageElement) {
    this.selector = messageElement.querySelector("input[type=checkbox]")
    this.id = this.selector.value

    // Extract the sender and the subject
    const from = messageElement.querySelector("td .from .printuser")
    this.fromWikidot = (
      !from.classList.contains("avatarhover") && from.innerText === "Wikidot"
    )
    this.subject = messageElement.querySelector(".subject").innerText
    this.previewText = messageElement.querySelector(".preview").innerText

    // Is this message an application?
    this.isApplication = (
      this.fromWikidot
      && this.subject === "You received a membership application"
    )

    if (this.isApplication) {
      // Which wiki is the application for?
      const wikiMatch = this.previewText.match(/applied for membership on (.*), one of your sites/)
      if (wikiMatch) this.applicationWiki = wikiMatch[1]
      else this.isApplication = false
    }
  }

  select() { this.selector.checked = true }
  deselect() { this.selector.checked = false }
  get isSelected() { return this.selector.checked }
}

async function deleteApplications(deleteAll = false) {
  const applications = []
  const messageElement = document.getElementById("message-area")

  let goToNextPage = true
  let thereAreMorePages = true

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

    // Save all selected messages
    const selectedMessages = messages
      .filter(message => message.isSelected)
    deleterDebug(`Found ${selectedMessages.length} applications`)
    applications.push(selectedMessages)

    // If there were no selected messages, and we are only deleting recent
    // messages (i.e. deleteAll is false), don't go to the next page
    if (selectedMessages.length === 0 && !deleteAll) goToNextPage = false

    if (goToNextPage) thereAreMorePages = await nextPage(messageElement)
  } while (goToNextPage && thereAreMorePages)

  // Delete all saved messages
  deleteMessages(applications.flat())

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

function deleteMessages(messages) {
  // Collate the wikis that the applications were for
  const wikiCounter = new Counter(messages.map(m => m.applicationWiki))
  // Produce a confirmation modal with the number of applications to delete
  const confirmModal = new OZONE.dialogs.ConfirmationDialog()
  confirmModal.content = `
    <p>Delete ${messages.length} applications?</p>
    <ul>${
      Object.entries(wikiCounter).map(
        ([wiki, count]) => `<li>${wiki}: ${count}</li>`
      )
    }</ul>
  `
  confirmModal.buttons = ["cancel", "delete applications"]
  confirmModal.addButtonListener("cancel", confirmModal.close)
  confirmModal.addButtonListener("delete applications", () => {
    const request = {
      action: "DashboardMessageAction",
      event: "removeMessages",
      messages: messages.map(m => m.id)
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
  return hash === "" || hash.indexOf("inbox") !== -1
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
 * Like Python's collections.Counter, returns an object with value keys and
 * count values. Use with new.
 */
function Counter(array) {
  array.forEach(val => (this[val] = (this[val] || 0) + 1))
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

(function main() {
  // Create the buttons
  const deleteRecentButton = document.createElement("button")
  deleteRecentButton.innerText = "Delete recent applications"
  deleteRecentButton.classList.add("red", "btn", "btn-xs", "btn-danger")
  deleteRecentButton.title = `
    Delete recent applications.
    Deletes applications on the first page, then the second, and so on, until
    a page with no applications is found.
  `.replace(/\s+/g, " ")
  deleteRecentButton.addEventListener("click", () => deleteApplications(false))

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
  deleteButtonsContainer.append(deleteRecentButton, " ", deleteAllButton)
  toggleDeleteButtons()

  const buttonLocation = document.getElementById("message-area").parentElement
  buttonLocation.prepend(deleteButtonsContainer)
})()

// Detect clicks to messages and inbox tabs and hide/show buttons as appropriate
addEventListener("click", () => {
  setTimeout(() => {
    toggleDeleteButtons()
  }, 500)
})
