/*
Wikidot applications deleter userscript

For installation instructions, see https://scpwiki.com/usertools
*/

// ==UserScript==
// @name        Wikidot applications deleter
// @description Adds a button to delete applications from your Wikidot inbox.
// @version     v0.0.0
// @updateURL   https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js
// @downloadURL https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js
// @include     https://www.wikidot.com/account/messages*
// ==/UserScript==

class Message {
  constructor(messageElement) {
    this.selector = messageElement.querySelector("input[type=checkbox]")

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

function deleteApplications() {
  const messages = getMessages()

  // If no messages are selected, select all messages
  if (countSelected(messages) === 0) {
    messages.forEach(message => message.select())
  }

  // Deselect all messages that are not applications
  messages.forEach(message => {
    if (!message.isApplication) message.deselect()
  })

  // Delete all selected messages
  deleteMessages()
}

function getMessages() {
  return Array.from(
    document.querySelectorAll("tr.message")
  ).map(el => new Message(el))
}

function countSelected(messages) {
  return messages.reduce((a, b) => a + b.isSelected, 0)
}

function deleteMessages() {
  WIKIDOT.modules.DashboardMessagesModule.removeSelectedMessages()
}

addEventListener("load", () => {
  // Create the button
  const deleteAppsButton = document.createElement("button")
  deleteAppsButton.innerText = "Delete applications"
  deleteAppsButton.classList.add("red", "btn", "btn-xs", "btn-danger")
  deleteAppsButton.title = `
    Delete selected applications.
    If no applications are selected, delete all applications on current page.
  `.replace(/\s+/g, " ")
  deleteAppsButton.addEventListener("click", deleteApplications)

  // Insert the button
  // Message area will initially be empty while the module loads
  // Lazy but effective: wait for content to appear, max of 5 secs
  function insertButton(count) {
    try {
      const messageArea = document.getElementById("message-area")
      messageArea.firstElementChild.lastElementChild.prepend(deleteAppsButton)
    } catch(e) {
      if (count < 300) requestAnimationFrame(() => insertButton(count + 1))
    }
  }
  insertButton(0)
})