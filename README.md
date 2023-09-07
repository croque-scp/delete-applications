# Wikidot applications deletion userscript

[Tampermonkey](https://www.tampermonkey.net/) userscript for [Wikidot](https://www.wikidot.com/) users.

Adds two buttons to the messages inbox:

* **Delete recent applications:** Deletes applications on the first page of the user's inbox, then the second, and so on until a page is found that already has no applications.
* **Delete all applications:** Deletes all applications in the user's inbox.

<p align="center">
  <img src="https://raw.githubusercontent.com/croque-scp/delete-applications/main/screenshot.png">
</p>

Before deletion is committed, a confirmation dialogue will be raised.

Especially useful for Wikidot administrators of popular sites, whose inboxes will quickly become full of applications, drowning out actual messages from other users. Use at own risk. 

Installation instructions: https://scpwiki.com/usertools#userscripts

## Installation via Tampermonkey

This method permanently adds the two buttons to your Wikidot inbox. They will be there for as long as you have both Tampermonkey and this userscript installed.

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Visit the [userscript directly](https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js).
3. Tampermonkey will prompt you to install the userscript. Click 'install' to do so, being sure to review the code first.
4. Visit your [Wikidot inbox](https://www.wikidot.com/account/messages). The two buttons will be there.

Uninstallation: Go to your Tampermonkey dashboard, which can be found in your browser extensions page. Click the bin icon next to the 'Wikidot applications deleter' script.

## Usage without Tampermonkey

This method adds the two buttons to your Wikidot inbox once only. They will no longer be there as soon as you leave the page.

1. Visit the [userscript directly](https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js) and copy the whole thing.
2. Visit your [Wikidot inbox](https://www.wikidot.com/account/messages) and open the JavaScript console.
3. Paste the userscript into the console and press enter. The two buttons will appear.

This is a one-off process that must be repeated every time you want to delete applications. Use this method if you don't want to (or can't) install this tool as a Tampermonkey userscript.