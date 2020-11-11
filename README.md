[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Travis (.com)](https://img.shields.io/travis/com/iqb-berlin/verona-player-simple?style=flat-square)](https://travis-ci.com/iqb-berlin/verona-player-simple)
![GitHub package.json version](https://img.shields.io/github/package-json/v/iqb-berlin/verona-player-simple?style=flat-square)

# verona-player-simple
This is a simple, dependency-less, vanilla-js-written, but full-featured unit player,
mainly as showcase for developers and for software-testing.

It does implement the
<a href="https://github.com/verona-interface" target="_blank">Verona 2.1.0</a>-Standard
and can be used for units containing simple any content in HTML-format.

Unit Description ist the <code>form</code>-content as HTML. Just give some names to the form element,
and the player does the rest. Use some special Ids for some special buttons.

## Running the Player
* You need a Verona-Host-System to run this Software, for example the 
[IQB-Testcenter](https://github.com/iqb-berlin/testcenter-setup) or the 
[Verona-Player-Testbed](https://github.com/iqb-berlin/verona-player-testbed).
* The whole player is `verona-simple-player-1.html`, there is no build-process or whatever. 

## Development Rules for Units

Any HTML-content can be used as unit. Examples can be found in this repository in the folder `sample-data`.

The Unit can contain any HTML-content (inner Part of `<body>`), even `<script>`- and `<style>`-tags!
* Don't use the `<form>`-element, since the whole unit will put into one.
* Use the `<fieldset>` to define pages if you want to have a multi-page unit.
* Any `<input>`-, `<textarea>`- and `<select>`-element will be tracked and content stored as well as any element
  containing the `contenteditable`-attribute. In both cases use the name element to set up variable names.
* The player contains some JS-Classes which can be used in unit-code to extend functionality.
* Whenever a Verona-message is received an event with the same name is thrown, whenever a message is sent,
  an event called `sent:{MessageName}` gets thrown afterwards. Use these events to hook into the player's
  functionality if you want to.
* That's it.


## Development

### E2e-Testing the Player
`
npm install
npm test
`

