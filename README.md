# Wikidot applications deletion userscript

[Tampermonkey](https://www.tampermonkey.net/) userscript for
[Wikidot](https://www.wikidot.com/) users.

Adds two buttons to the messages inbox:

* **Delete recent applications:** Deletes applications on the first page of
  the user's inbox, then the second, and so on until a page is found that
  already has no applications.
* **Delete all applications:** Deletes all applications in the user's
  inbox.

<p align="center">
  <img src="https://raw.githubusercontent.com/croque-scp/delete-applications/main/screenshot.png">
</p>

Before deletion is committed, a confirmation dialogue will be raised.

Especially useful for Wikidot administrators of popular sites, whose
inboxes will quickly become full of applications, drowning out actual
messages from other users. Use at own risk. 

Installation instructions: https://scpwiki.com/usertools#userscripts

## Installation via Tampermonkey

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Visit the [userscript
   directly](https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js).
3. Tampermonkey will prompt you to install the userscript. Click 'install'
   to do so, being sure to review the code first.

## Usage without Tampermonkey

1. Visit the [userscript
   directly](https://github.com/croque-scp/delete-applications/raw/main/delete-applications.user.js)
   and copy the whole thing.
2. Visit your [Wikidot inbox](https://www.wikidot.com/account/messages) and
   open the JavaScript console.
3. Paste the userscript into the console and press enter.
4. Enter one of the following, and then press enter:
   * `deleteApplications()` to delete recent applications
   * `deleteApplications(true)` to delete all applications
