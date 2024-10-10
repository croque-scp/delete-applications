/*
Wikidot user-specific message deleter userscript

For installation instructions, see https://scpwiki.com/usertools
*/

/* CHANGELOG

v1.3.1 (2024-10-10)
- Created userscript.
*/

// ==UserScript==
// @name        Wikidot user PM deleter
// @description Adds a button to delete PMs from a user from your Wikidot inbox.
// @author      Croquembouche
// @version     v1.3.1
// @updateURL   https://github.com/croque-scp/delete-applications/raw/main/delete-from-user.user.js
// @downloadURL https://github.com/croque-scp/delete-applications/raw/main/delete-from-user.user.js
// @supportURL  https://www.wikidot.com/account/messages#/new/2893766
// @match       https://www.wikidot.com/account/messages*
// ==/UserScript==

/* global WIKIDOT, OZONE */

/* ===== Utilities ===== */

const deleterDebug = log => console.debug("User PM deleter:", log)

const supportUser = showAvatar => `
  ${
    showAvatar
      ? `<span class="printuser avatarhover" style="white-space: nowrap">`
      : ""
  }
    <a href="https://www.wikidot.com/user:info/croquembouche" onclick="WIKIDOT.page.listeners.userInfo(2893766); return false;" >
      ${
        showAvatar
          ? `<img
              class="small"
              src="https://www.wikidot.com/avatar.php?userid=2893766" style="background-image:url(https://www.wikidot.com/userkarma.php?u=2893766)"
            >`
          : ""
      }Croquembouche
    </a>
  ${showAvatar ? `</span>` : ""}
`

function getMessagesOnPage() {
  return Array.from(document.querySelectorAll("tr.message")).map(
    el => new Message(el)
  )
}

function countSelected(messages) {
  return messages.reduce((a, b) => a + b.isSelected, 0)
}

/**
 * Waits for the given number of milliseconds.
 * @param {Number} ms
 */
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class Message {
  /**
   * Collates details about a message based on its little preview.
   * @param {HTMLElement} messageElement - Inbox container.
   */
  constructor(messageElement) {
    /** @type {HTMLInputElement} */
    this.selector = messageElement.querySelector("input[type=checkbox]")
    /** @type {String} */
    this.id = this.selector.value

    // Extract the sender
    const from = messageElement.querySelector("td .from .printuser")
    this.sender = from.innerText
  }

  select() {
    this.selector.checked = true
  }
  deselect() {
    this.selector.checked = false
  }
  get isSelected() {
    return this.selector.checked
  }
}

/* ===== */

async function deleteMessagesFromUser(username = "") {
  if (!username) return

  const messagesToDelete = []
  const messageElement = document.getElementById("message-area")

  let thereAreMorePages = true

  const scanningModal = new OZONE.dialogs.WaitBox()
  scanningModal.content = `Scanning your inbox for messages from ${username}...`
  scanningModal.show()

  await firstPage(messageElement)

  do {
    const messages = getMessagesOnPage()

    // If no messages are selected, select all messages
    if (countSelected(messages) === 0) {
      messages.forEach(message => message.select())
    }

    // Deselect all messages that are not from the user
    messages.forEach(message => {
      if (message.sender !== username) message.deselect()
    })

    // Save all selected messages
    const selectedMessages = messages.filter(message => message.isSelected)
    deleterDebug(`Found ${selectedMessages.length} messages`)
    messagesToDelete.push(selectedMessages)

    thereAreMorePages = await nextPage(messageElement)
  } while (thereAreMorePages)

  // Reset UI back to the first page
  await firstPage(messageElement)

  // Delete all saved messages
  createDeleteConfirmationModal(messagesToDelete.flat())
}

/**
 * @param {Message[]} messages
 */
function createDeleteConfirmationModal(messages) {
  const messagesCount = messages.length

  // Produce a confirmation modal with the number of applications to delete
  const confirmModal = new OZONE.dialogs.ConfirmationDialog()
  confirmModal.content = `
    <p>Delete ${messagesCount} messages?</p>
    <p>This is <strong>not reversible.</strong></p>
    <p><em>Please report any issues during the deletion process to ${supportUser(
      true
    )}.</em></p>
  `
  confirmModal.buttons = ["cancel", "delete messages"]
  confirmModal.addButtonListener("cancel", confirmModal.close)
  confirmModal.addButtonListener("delete messages", async () => {
    const progressModal = new OZONE.dialogs.SuccessBox()
    progressModal.content = `
      <p>Deleting ${messagesCount} messages...</p>
      <p id="delete-progress-text"></p>
      <progress id="delete-progress" style="width: 100%"></progress>
    `
    progressModal.timeout = null
    progressModal.show()

    const success = await deleteMessagesBatches(
      messages,
      async (batchIndex, batchCount, batchSize) => {
        if (batchCount === 1) return
        document.getElementById("delete-progress-text").textContent = `
          Batch ${batchIndex + 1} of ${batchCount} (${batchSize} messages)
        `
        document.getElementById("delete-progress").max = batchCount
        document.getElementById("delete-progress").value = batchIndex + 1
        await wait(1500)
      }
    )

    WIKIDOT.modules.DashboardMessagesModule.app.refresh()

    if (success) {
      const successModal = new OZONE.dialogs.SuccessBox()
      successModal.content = `
        <p>Deleted ${messagesCount} messages.<p>
      `
      successModal.show()
    } else {
      const errorModal = new OZONE.dialogs.ErrorDialog()
      errorModal.content = `
        <p>Failed to delete messages.</p>
        <p>Please send a message to ${supportUser(true)}.</p>
      `
      errorModal.show()
    }
  })

  confirmModal.focusButton = "cancel"
  confirmModal.show()
}

/**
 * @callback deleteMessagesBatches_beforeBatch
 * @param {Number} batchIndex
 * @param {Number} batchCount
 * @param {Number} batchSize
 * @return {Promise<void>}
 */

/**
 * Deletes the given messages in batches.
 * @param {Message[]} messages
 * @param {deleteMessagesBatches_beforeBatch} beforeBatch - Callback that receives deletion progress info.
 * @return {Promise<Boolean>} True when all deletes succeeded.
 */
async function deleteMessagesBatches(messages, beforeBatch) {
  const batchSize = 100
  const batchCount = Math.ceil(messages.length / batchSize)
  let batchIndex = 0
  while (messages.length) {
    const batch = messages.splice(0, batchSize)
    await beforeBatch(batchIndex, batchCount, batch.length)
    try {
      await deleteMessages(batch.map(message => message.id))
    } catch (error) {
      deleterDebug("Deletes failed")
      console.error(error)
      return false
    }
    batchIndex += 1
  }
  return true
}

/**
 * Delete the messages with the given IDs.
 * @param {Number[]} messageIds
 */
function deleteMessages(messageIds) {
  return new Promise((resolve, reject) => {
    try {
      OZONE.ajax.requestModule(
        null,
        {
          action: "DashboardMessageAction",
          event: "removeMessages",
          messages: messageIds,
        },
        resolve
      )
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Whether to show the deletion buttons, based on the current URL.
 * @returns {Boolean}
 */
function shouldShowDeleteButtons() {
  return /^(#(\/inbox(\/(p[0-9]+\/?)?)?)?)?$/.test(location.hash)
}

/**
 * Go to the first page of messages.
 * @param {HTMLElement} messageElement - Inbox container
 * @returns {Promise<Boolean>}
 */
async function firstPage(messageElement) {
  deleterDebug("Going to first page")
  const pager = messageElement.querySelector(".pager")
  if (pager == null) return false
  const currentPageButton = pager.querySelector(".current")
  if (currentPageButton == null) return false
  if (currentPageButton.textContent.trim() === "1") return false

  // The first page button should always be visible
  const firstPageButton = pager.querySelector(".target [href='#/inbox/p1']")
  if (firstPageButton == null) return false

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
 * Iterate to the next page of messages.
 *
 * @param {HTMLElement} messageElement - Inbox container
 * @returns {Promise<Boolean>} False if last page; otherwise wait for next page to load then true.
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

;(function () {
  // Set up container for userscript controls, unless another userscript already did
  let scriptControlContainer = document.getElementById("messages-userscripts")
  if (!scriptControlContainer) {
    scriptControlContainer = document.createElement("div")
    scriptControlContainer.id = "messages-userscripts"
    scriptControlContainer.style.display = "flex"
    scriptControlContainer.style.justifyContent = "end"
    scriptControlContainer.style.flexWrap = "wrap"
    scriptControlContainer.style.marginBlock = "1.5rem"
    scriptControlContainer.style.gap = "1.5rem"

    document
      .getElementById("message-area")
      .parentElement.prepend(scriptControlContainer)
  }

  const deleteButtonsContainer = document.createElement("div")
  deleteButtonsContainer.id = "delete-from-user-controls"
  deleteButtonsContainer.style.border = "thin solid lightgrey"
  deleteButtonsContainer.style.borderRadius = "0.5rem"
  deleteButtonsContainer.style.display = shouldShowDeleteButtons()
    ? "flex"
    : "none"
  deleteButtonsContainer.style.flexDirection = "column"
  deleteButtonsContainer.style.maxWidth = "max-content"
  deleteButtonsContainer.style.padding = "1rem"
  deleteButtonsContainer.innerHTML = `
    <p style="font-size: smaller">
      <a href="https://scpwiki.com/usertools#delete-applications">Delete PMs from user</a> by ${supportUser()}
    </p>
  `
  scriptControlContainer.appendChild(deleteButtonsContainer)

  const deleteForm = document.createElement("form")
  deleteForm.id = "delete-from-user-buttons"
  deleteForm.style.display = "flex"
  deleteForm.style.flexDirection = "row"
  deleteForm.style.flexWrap = "wrap"
  deleteForm.style.gap = "0.5rem"
  deleteButtonsContainer.appendChild(deleteForm)

  const usernameField = document.createElement("input")
  usernameField.classList.add("form-control")
  usernameField.style.width = "auto"
  usernameField.style.flex = "1"
  usernameField.placeholder = "Enter username"
  deleteForm.appendChild(usernameField)

  const deleteButton = document.createElement("input")
  deleteButton.type = "submit"
  deleteButton.value = "Delete"
  deleteButton.classList.add("red", "btn", "btn-danger")
  deleteButton.title = `Delete all messages from the specified user.`
  deleteForm.appendChild(deleteButton)

  deleteForm.addEventListener("submit", submitEvent => {
    deleteMessagesFromUser(usernameField.value)
    submitEvent.preventDefault()
    submitEvent.stopPropagation()
    return false
  })

  // Detect clicks to messages and inbox tabs and hide/show buttons as appropriate
  addEventListener("click", () =>
    setTimeout(() => {
      deleteButtonsContainer.style.display = shouldShowDeleteButtons()
        ? "flex"
        : "none"
    }, 500)
  )
})()
