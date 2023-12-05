[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI Status](https://scm.cms.hu-berlin.de/iqb/verona-player-simple/badges/main/pipeline.svg)](https://scm.cms.hu-berlin.de/iqb/verona-player-simple)
![GitHub package.json version](https://img.shields.io/github/package-json/v/iqb-berlin/verona-player-simple)

# verona-player-simple
This is a simple, dependency-less, vanilla-js-written, but full-featured unit player,
mainly as showcase for developers and for software-testing.

It does implement the
<a href="https://github.com/verona-interface" target="_blank">Verona 5.0.0</a>-Standard
and can be used for units containing simple any content in HTML-format.

Unit Description ist the <code>form</code>-content as HTML. Just give some names to the form element,
and the player does the rest. Use some special Ids for some special buttons.

## Running the Player
* You need a Verona-Host-System to run this Software, for example the 
[IQB-Testcenter](https://github.com/iqb-berlin/testcenter-setup) or the 
[Verona-Player-Testbed](https://github.com/iqb-berlin/verona-player-testbed).
* The whole player is `verona-simple-player-5.0.html`, there is no build-process or whatever. 

## Development Rules for Units
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
Any HTML-content can be used as unit. Examples can be found in this repository in the folder `sample-data`.

The Unit can contain any HTML-content (inner Part of `<body>`), even `<script>`- and `<style>`-tags!
* Don't use the `<form>`-element, since the whole unit will put into one.
* Use the `<fieldset>`-element to define a page if you want to have a multi-page unit. In this case on the root-level 
  there should only be `<fieldset>`-elements or absolute/static positioned elements, otherwise it could confuse
  the page detection.
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

