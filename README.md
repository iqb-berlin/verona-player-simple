[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

# verona-player-html
This is a simple, dependency-less, vanilla-js-written, but full-featured unit player,
mainly as showcase for developers and for software-testing.

It does implement the
<a href="https://github.com/verona-interface" target="_blank">Verona 2.1.0</a>-Standard
and can be used for units containing simple any content in HTML-format.

Unit Description ist the <code>form</code>-content as HTML. Just give some names to the form element,
and the player does the rest. Use some special Ids for some special buttons.

# Development rules for units
The Unit can contain any HTMl-content, even `<script>`- and `<style>`-tags!
* Don't use the `<form>`-element, since the whole unit will put into one.
* Use the `<fieldset>` to define pages if you want to have a multi-page unit.
* Any `<input>`-, `<textarea>`- and `<select>`-element will be tracked and content stored as well as any element
  containing the `contenteditable`-attribute. In both cases use the name element to set up variable names.
* The player contains some JS-Classes which can be used in unit-code to extend functionality.
* Whenever a Verona-message is received an event with the same name is thrown, whenever a message is sent,
  an event called `sent:{MessageName}` gets thrown afterwards. Use these events to hook into the player's
  functionality if you want to.
* that's it.
