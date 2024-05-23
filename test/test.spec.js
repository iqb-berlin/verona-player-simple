/* eslint-disable no-undef */ // TODO find a solution to import it, describe etc. in a way eslint can see
require('selenium-webdriver');
const jasmine = require('jasmine');
const { Options } = require('selenium-webdriver/firefox');
const {
  Builder, By, Key, Select
} = require('selenium-webdriver');
const { MessageRecorder } = require('iqb-dev-components');
const fs = require('fs');
const testConfig = require('./config.json');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000; // firefox is starting too slow sometimes (1 of 750 times on my machine)
MessageRecorder.defaultWaitingTime = 500;

let driver;

const options = new Options();
if (testConfig.headless) {
  options.addArguments('-headless');
}

const playerPath = fs.realpathSync(`${__dirname}/../verona-player-simple-5.2.html`);

const send = async message => {
  await driver.executeScript(`window.postMessage(${JSON.stringify(message)}, '*');`);
};

const loadPlayer = async playerSettings => {
  const query = playerSettings
    ? Object.keys(playerSettings).reduce((carry, item) => `${carry}&${item}=${playerSettings[item]}`, '?')
    : '';

  await driver.get(`file:${playerPath}${query}`);
};

const VopState = {
  async get(webdriver) {
    // eslint-disable-next-line no-undef,no-underscore-dangle
    return webdriver.executeScript(() => window.vsp.Message.send._createStateMsg(true));
  },
  async getAnswers(webdriver) {
    const msg = await VopState.get(webdriver);
    return JSON.parse(msg.unitState.dataParts.answers);
  },
  async getAnswer(webdriver, id) {
    return (await VopState.getAnswers(webdriver)).filter(entry => entry.id === id)[0];
  }
};

const ComputedStyle = {
  get(webdriver, querySelector, styles) {
    return webdriver.executeScript(
      // eslint-disable-next-line no-shadow
      (querySelector, styles) => styles
        .map(style => [...document.querySelectorAll(querySelector)].map(element => getComputedStyle(element)[style])),
      querySelector,
      styles
    );
  }
};

const longText = (length = 2000) => Array.from(
  { length },
  (_, i) => Array.from({ length: 3 + (i % 10) }, () => 'x').join('')
).join(' ');

describe('simple player', () => {
  beforeAll(async () => {
    driver = await new Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(options)
      .build();
  });

  beforeEach(async () => {
    await loadPlayer();
  });

  afterAll(async () => {
    if (testConfig.keepOpen) {
      for (;;) { /* empty */ }
    }
  });

  it('should load an unit on `vopStartCommand`', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: '<h1>Virtual Unit</h1>',
      sessionId: '1'
    });

    const title = await driver.findElement(By.css('h1'));

    expect(await title.getText()).toBe('Virtual Unit');
  });

  it('should open the page in `startPage`', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<fieldset><legend id="p1">Page 1</legend></fieldset><fieldset><legend id="p2">Page 2</legend></fieldset>',
      sessionId: '1',
      playerConfig: {
        pagingMode: 'separate',
        startPage: '2'
      }
    });

    const page2 = await driver.findElement(By.id('p2'));

    expect(await page2.isDisplayed()).toBeTrue();
  });

  it('ignore command, when sessionId is wrong', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<h1>Virtual Unit</h1><input name='field'>",
      sessionId: '1'
    });

    await send({
      type: 'vopStopCommand',
      sessionId: 'wrong'
    });

    const input = await driver.findElement(By.css('input[name="field"]'));

    try {
      await input.click();
    } catch (expection) {
      fail('should still be clickable');
    }
  });

  it('should display paginated unit when pages are available and `pagingMode` = `separate`', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<fieldset><legend id="p1">Page 1</legend></fieldset><fieldset><legend id="p2">Page 2</legend></fieldset>',
      sessionId: '1',
      playerConfig: {
        pagingMode: 'separate'
      }
    });

    const p1 = await driver.findElement(By.css('#p1'));
    const p2 = await driver.findElement(By.css('#p2'));
    const nextPage = await driver.findElement(By.css('#next-page'));
    const prevPage = await driver.findElement(By.css('#prev-page'));

    expect(await p1.isDisplayed()).toBeTrue();
    expect(await p2.isDisplayed()).toBeFalse();
    expect(await nextPage.isDisplayed()).toBeFalse();
    expect(await prevPage.isDisplayed()).toBeFalse();

    await send({
      type: 'vopPageNavigationCommand',
      target: '2',
      sessionId: '1'
    });

    expect(await p1.isDisplayed()).toBeFalse();
    expect(await p2.isDisplayed()).toBeTrue();
    expect(await nextPage.isDisplayed()).toBeFalse();
    expect(await prevPage.isDisplayed()).toBeFalse();

    await send({
      type: 'vopPageNavigationCommand',
      target: '1',
      sessionId: '1'
    });

    expect(await p1.isDisplayed()).toBeTrue();
    expect(await p2.isDisplayed()).toBeFalse();
    expect(await nextPage.isDisplayed()).toBeFalse();
    expect(await prevPage.isDisplayed()).toBeFalse();
  });

  it('should not display pagination buttons when `pagingMode` = `concat-scroll`', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<fieldset><legend id="p1">Page 1</legend></fieldset><fieldset><legend id="p2">Page 2</legend></fieldset>',
      sessionId: '1',
      playerConfig: {
        pagingMode: 'concat-scroll'
      }
    });

    const p1 = await driver.findElement(By.css('#p1'));
    const p2 = await driver.findElement(By.css('#p2'));
    const nextPage = await driver.findElement(By.css('#next-page'));
    const prevPage = await driver.findElement(By.css('#prev-page'));

    expect(await nextPage.isDisplayed()).toBeFalse();
    expect(await prevPage.isDisplayed()).toBeFalse();

    expect(await p1.isDisplayed()).toBeTrue();
    expect(await p2.isDisplayed()).toBeTrue();
  });

  it('should not display pagination buttons when `pagingMode` = `concat-scroll-snap`', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<fieldset><legend id="p1">Page 1</legend></fieldset><fieldset><legend id="p2">Page 2</legend></fieldset>',
      sessionId: '1',
      playerConfig: {
        pagingMode: 'concat-scroll-snap'
      }
    });

    const p1 = await driver.findElement(By.css('#p1'));
    const p2 = await driver.findElement(By.css('#p2'));
    const nextPage = await driver.findElement(By.css('#next-page'));
    const prevPage = await driver.findElement(By.css('#prev-page'));

    expect(await nextPage.isDisplayed()).toBeFalse();
    expect(await prevPage.isDisplayed()).toBeFalse();

    expect(await p1.isDisplayed()).toBeTrue();
    expect(await p2.isDisplayed()).toBeTrue();
  });

  it('should display pagination buttons when `pagingMode` = `button`', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<fieldset><legend id="p1">Page 1</legend></fieldset><fieldset><legend id="p2">Page 2</legend></fieldset>',
      sessionId: '1',
      playerConfig: {
        pagingMode: 'button'
      }
    });

    const p1 = await driver.findElement(By.css('#p1'));
    const p2 = await driver.findElement(By.css('#p2'));
    const nextPage = await driver.findElement(By.css('#next-page'));
    const prevPage = await driver.findElement(By.css('#prev-page'));

    expect(await nextPage.isDisplayed()).toBeTrue();
    expect(await prevPage.isDisplayed()).toBeTrue();

    expect(await p1.isDisplayed()).toBeTrue();
    expect(await p2.isDisplayed()).toBeFalse();
  });

  it('should load values into the right forms', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: '<input type="text" /><input type="text" name="field" /><p contenteditable></p>',
      sessionId: '1',
      unitState: {
        dataParts: {
          answers: JSON.stringify([
            { id: '', value: ['firstContent', 'thirdContent'] },
            { id: 'field', value: 'secondContent' }
          ])
        }
      }
    });

    const input1 = await driver.findElement(By.css('#unit input:nth-of-type(1)'));
    const input2 = await driver.findElement(By.css('#unit input:nth-of-type(2)'));
    const input3 = await driver.findElement(By.css('#unit p'));

    expect(await input1.getAttribute('value')).toEqual('firstContent');
    expect(await input2.getAttribute('value')).toEqual('secondContent');
    expect(await input3.getText()).toEqual('thirdContent');
  });

  it('should collect values from form', async () => {
    await loadPlayer({
      debounceStateMessages: 150,
      debounceKeyboardEvents: 0
    });
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <input type="text" name="field" value="a" />
        <input type="text" name="field" value="b" />
        <p contenteditable>c</p>`,
      sessionId: '1'
    });

    await MessageRecorder.recordMessages(driver);

    const msg = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1500);

    expect(msg.unitState.dataParts.answers || {}).toEqual(JSON.stringify([
      { id: 'field', status: 'DISPLAYED', value: ['a', 'b'] },
      { id: '', status: 'DISPLAYED', value: 'c' }
    ]));
  });

  it('should support various form elements', async () => {
    await loadPlayer({
      debounceStateMessages: 0,
      debounceKeyboardEvents: 0
    });

    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <textarea name="text-area"></textarea>
        <select name="multi-select" size="3" multiple>
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
        </select>
        <input type="radio" name="radio-group" value="a" />
        <input type="radio" name="radio-group" value="b" />
        <input type="radio" name="radio-group" value="c" />
        <input type="checkbox" name="check-box-a" />
        <input type="checkbox" name="check-box-b" />`,
      sessionId: '1',
      unitState: {
        dataParts: {
          answers: JSON.stringify([
            { id: 'check-box-a', status: 'VALUE_CHANGED', value: 'on' },
            { id: 'radio-group', status: 'VALUE_CHANGED', value: 'b' },
            { id: 'multi-select', status: 'VALUE_CHANGED', value: ['b', 'c'] }
          ])
        }
      }
    });

    const textArea = await driver.findElement(By.css('[name="text-area"]'));
    const multiSelectA = await driver.findElement(By.css('[name="multi-select"] [value="a"]'));
    const radioGroupA = await driver.findElement(By.css('[name="radio-group"][value="a"]'));
    const checkBoxA = await driver.findElement(By.css('[name="check-box-a"]'));
    const checkBoxB = await driver.findElement(By.css('[name="check-box-b"]'));

    await MessageRecorder.recordMessages(driver, 'vopStateChangedNotification');

    await textArea.sendKeys('text area content');
    await multiSelectA.click();
    await radioGroupA.click();
    await checkBoxA.click();
    await checkBoxB.click();

    const msg = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification');
    expect(msg.unitState.dataParts.answers || {}).toEqual(JSON.stringify([
      { id: 'text-area', status: 'VALUE_CHANGED', value: 'text area content' },
      { id: 'multi-select', status: 'VALUE_CHANGED', value: ['a', 'b', 'c'] },
      { id: 'radio-group', status: 'VALUE_CHANGED', value: 'a' },
      { id: 'check-box-a', status: 'VALUE_CHANGED', value: '' },
      { id: 'check-box-b', status: 'VALUE_CHANGED', value: 'on' }
    ]));
  });

  it('should collect values from element from extension', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <script>
          let special = false;
          Unit.dataPartsCollectors.special = () => ({ id: 'special', value: special ? 'yes' : 'no' });
          PlayerUI.addEventListener('click', '#specialControl', () => {
            special = true;
          });
        </script>
        <div id="specialControl">X</div>
    `,
      sessionId: '1'
    });

    const specialControl = await driver.findElement(By.css('#specialControl'));
    const message1 = await VopState.get(driver);
    await specialControl.click();
    const message2 = await VopState.get(driver);

    expect(message1.unitState.dataParts).toEqual({
      answers: '[]',
      special: '{"id":"special","value":"no"}'
    });

    expect(message2.unitState.dataParts).toEqual({
      answers: '[]',
      special: '{"id":"special","value":"yes"}'
    });
  });

  it('should collect values even if there are changed programmatically', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <input type="text" id="field" name="field">
        <button id="button">change!</button>
        
        <script>
          const field = document.querySelector('#field');
          const button = document.querySelector('#button');
        
          button.addEventListener('click', e => {
            e.preventDefault();
            field.value = "programmatically changed";
          });
        </script>
    `,
      sessionId: '1'
    });

    const field = await driver.findElement(By.css('#field'));
    const button = await driver.findElement(By.css('#button'));

    await MessageRecorder.recordMessages(driver);

    await field.sendKeys('manually changed'); // debounce 1000

    const message1 = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1200);

    await button.click();

    const message2 = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1200);

    expect(message1.unitState.dataParts.answers || {})
      .toEqual('[{"id":"field","status":"VALUE_CHANGED","value":"manually changed"}]');

    expect(message2.unitState.dataParts.answers || {})
      .toEqual('[{"id":"field","status":"VALUE_CHANGED","value":"programmatically changed"}]');
  });

  it('debounce returning messages', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input type='text' name='field' value='' />",
      sessionId: '1'
    });

    const field = await driver.findElement(By.css('[name="field"]'));

    await MessageRecorder.recordMessages(driver);

    await field.sendKeys('first input'); // debounce 1000

    // wait 100 for message; none should be there
    const message1 = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 100);

    await field.sendKeys(' second input'); // debounce 1000

    // after 1000, message should be sent
    const message2 = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1200);

    expect(message1).toBeNull();

    expect(message2.unitState.dataParts.answers || {})
      .toEqual('[{"id":"field","status":"VALUE_CHANGED","value":"first input second input"}]');
  });

  it('should execute script in unit', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <script>
          document.addEventListener('vopStartCommand', () =>
            document.querySelector('#unit p').innerHTML = 'rewritten'
          );
        </script>
        <p>original</p>`,
      sessionId: '1'
    });

    const unit = await driver.findElement(By.css('#unit p'));

    await unit.click();

    expect(await unit.getText()).toEqual('rewritten');
  });

  it('should apply style in unit', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<style>#thing {background-color: rgb(143, 188, 143)}</style><p id="thing">should be green</p>',
      sessionId: '1'
    });

    const thing = await driver.findElement(By.css('#thing'));

    expect(await thing.getCssValue('background-color')).toEqual('rgb(143, 188, 143)');
  });

  describe('unit navigation', () => {
    it('should enable the buttons given in enabledNavigationTargets', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: '<h1>Virtual Unit</h1>',
        sessionId: '1',
        playerConfig: {
          enabledNavigationTargets: ['next', 'previous']
        }
      });

      const nextUnit = await driver.findElement(By.css('#next-unit'));
      const prevUnit = await driver.findElement(By.css('#prev-unit'));
      const lastUnit = await driver.findElement(By.css('#last-unit'));
      const firstUnit = await driver.findElement(By.css('#first-unit'));
      const endUnit = await driver.findElement(By.css('#end-unit'));

      expect(await nextUnit.isEnabled()).toBeTrue();
      expect(await prevUnit.isEnabled()).toBeTrue();
      expect(await lastUnit.isEnabled()).toBeFalse();
      expect(await firstUnit.isEnabled()).toBeFalse();
      expect(await endUnit.isEnabled()).toBeFalse();
    });
  });

  it('should report state on input', async () => {
    await loadPlayer({
      debounceStateMessages: 150,
      debounceKeyboardEvents: 0
    });

    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input id='the-item' name='the-item' type='text'/>",
      sessionId: '1'
    });

    const input = await driver.findElement(By.css('#the-item'));

    await MessageRecorder.recordMessages(driver);

    await input.sendKeys('something');

    const msg = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1500);
    msg.timeStamp = NaN;

    expect(msg).toEqual({
      sessionId: '1',
      timeStamp: NaN,
      type: 'vopStateChangedNotification',
      unitState: {
        dataParts: {
          answers: JSON.stringify([
            { id: 'the-item', status: 'VALUE_CHANGED', value: 'something' }
          ])
        },
        presentationProgress: 'complete',
        responseProgress: 'complete',
        unitStateDataType: 'iqb-standard@1.0'
      }
    });
  });

  it('should send `vopWindowFocusChangedNotification` on focus change', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<iframe id='sub-frame'></iframe><div id='outside'>outside</div>",
      sessionId: '1'
    });

    await MessageRecorder.recordMessages(driver);

    const subFrame = await driver.findElement(By.css('#sub-frame'));
    await subFrame.click();

    let msg = await MessageRecorder.getLastMessage(driver, 'vopWindowFocusChangedNotification');

    expect(msg.hasFocus).toBeFalse();

    const player = await driver.findElement(By.css('#outside'));
    await player.click();

    msg = await MessageRecorder.getLastMessage(driver, 'vopWindowFocusChangedNotification');

    expect(msg.hasFocus).toBeTrue();
  });

  it('should send the correct responseProgress', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input type='number' name='first' required /><input type='number' name='second' required />",
      sessionId: '1'
    });

    const first = await driver.findElement(By.css('[name="first"]'));
    const second = await driver.findElement(By.css('[name="second"]'));

    await MessageRecorder.recordMessages(driver);

    let message = await VopState.get(driver);
    expect(message.unitState.responseProgress).toEqual('none');

    await first.sendKeys('not a number');

    message = await VopState.get(driver);
    expect(message.unitState.responseProgress).toEqual('none');

    await second.sendKeys('1');

    message = await VopState.get(driver);
    expect(message.unitState.responseProgress).toEqual('some');

    await first.clear();
    await first.sendKeys('1');

    message = await VopState.get(driver);
    expect(message.unitState.responseProgress).toEqual('complete');
  });

  it('should send the correct responseProgress on programmatically changed fields', async () => {
    await loadPlayer({
      debounceStateMessages: 150,
      debounceKeyboardEvents: 0
    });
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input type='text' name='field' required />",
      sessionId: '1'
    });

    await MessageRecorder.recordMessages(driver);

    const message1 = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1500);
    expect(message1.unitState.responseProgress).toEqual('none');

    await driver.executeScript(() => {
      document.querySelector('[name="field"]').value = 'programmatically changed value!';
    });

    const message2 = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1500);
    expect(message2.unitState.responseProgress).toEqual('complete');
  });

  describe('should show appropriate message on `vopNavigationDeniedNotification`', () => {
    it('when reason is `responsesIncomplete and also trigger form validation `', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <fieldset>
            <div>${longText()}</div>
            <label><input name="num" type="number" id="numberField">Number Field</label>
          </fieldset>
          <fieldset>
            <input type="text" name="req" required id="requiredField"><label for="requiredField">Required Field</label>
          </fieldset>`,
        sessionId: '1',
        playerConfig: {
          enabledNavigationTargets: ['#next', '#prev'],
          pagingMode: 'button'
        }
      });

      const requiredField = await driver.findElement(By.id('requiredField'));
      const numberField = await driver.findElement(By.id('numberField'));
      numberField.sendKeys('Not a number!');

      const vspMessage = await driver.findElement(By.css('vsp-message'));
      expect(await vspMessage.isDisplayed()).toBeFalse();

      await send({ type: 'vopNavigationDeniedNotification', sessionId: '1', reason: ['responsesIncomplete'] });
      await driver.sleep(200);

      expect(await vspMessage.isDisplayed()).toBeTrue();
      const vspMessageLinks = await vspMessage.findElements(By.css('[onclick]'));
      expect(vspMessageLinks.length).toEqual(2);

      await vspMessageLinks[0].click();
      expect((await driver.findElements(By.css('vsp-pointer'))).length).toEqual(1);
      expect(await requiredField.isDisplayed()).toBeFalse();
      expect(await numberField.isDisplayed()).toBeTrue();

      await vspMessageLinks[1].click();
      expect((await driver.findElements(By.css('vsp-pointer'))).length).toEqual(1);
      expect(await numberField.isDisplayed()).toBeFalse();
      expect(await requiredField.isDisplayed()).toBeTrue();

      await vspMessage.findElement(By.css('vsp-message-close')).click();
      expect(await vspMessage.isDisplayed()).toBeFalse();
      expect((await driver.findElements(By.css('vsp-pointer'))).length).toEqual(0);
    });

    it('when reason = `presentationIncomplete`, even if presentationComplete is extended', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <script>
            let visitedCounter = 2;
            PlayerUI.presentationReportFactors['special'] = () =>
              Array.from({ length: visitedCounter }, () => \`<div onclick=''>Special Stuff was not visited</div>\`);
          </script>
          <fieldset>
            <div id="decreaser" onclick="visitedCounter--">This would be a sub-navigation, a gallery or such</div>
            <div>${longText()}</div>
            <label><input name="a" id="fieldA">Field A</label>
          </fieldset>
          <fieldset>
            <label><input name="b" id="fieldB" required>Field B</label>
          </fieldset>
          `,
        sessionId: '1',
        playerConfig: {
          pagingMode: 'button'
        }
      });

      const vspMessage = await driver.findElement(By.css('vsp-message'));
      expect(await vspMessage.isDisplayed()).toBeFalse();

      await send({ type: 'vopNavigationDeniedNotification', sessionId: '1', reason: ['presentationIncomplete'] });
      await driver.sleep(60);
      expect(await vspMessage.isDisplayed()).toBeTrue();

      // we expect 4 messages: 2 from pages (one not scrolled to bottom, one not seen, 2 from special)
      expect((await vspMessage.findElements(By.css('[onclick]'))).length).toEqual(4);

      const decreaser = await driver.findElement(By.css('#decreaser'));
      await decreaser.click();
      const nextPage = await driver.findElement(By.css('#next-page'));
      await nextPage.click();

      // we expect 3 messages: 1 from pages, 1 from special and 1 from responsesIncomplete
      await send({
        type: 'vopNavigationDeniedNotification',
        sessionId: '1',
        reason: ['presentationIncomplete', 'responsesIncomplete']
      });
      await driver.sleep(30);
      expect(await vspMessage.isDisplayed()).toBeTrue();
      expect((await vspMessage.findElements(By.css('[onclick]'))).length).toEqual(3);
    });
  });

  it('should treat elements with `contenteditable` like form fields regarding `name` and `required`', async () => {
    await loadPlayer({
      debounceStateMessages: 150,
      debounceKeyboardEvents: 0
    });
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <pre contenteditable required name="must-have"></pre>
        <pre contenteditable name="nice-2-have"></pre>
        <pre contenteditable id="unnamed"></pre>
      `,
      sessionId: '1'
    });

    const mustHave = await driver.findElement(By.css('[name="must-have"]'));
    const nice2Have = await driver.findElement(By.css('[name="nice-2-have"]'));
    const unnamed = await driver.findElement(By.id('unnamed'));

    await MessageRecorder.recordMessages(driver);

    let message = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1500);
    expect(message.unitState.responseProgress).toEqual('some'); // because emtpy non-required text-items are valid

    await nice2Have.sendKeys('something');
    await unnamed.sendKeys('anything');

    message = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1500);
    expect(message.unitState.responseProgress).toEqual('some');
    expect(message.unitState.dataParts.answers).toEqual(JSON.stringify([
      { id: 'must-have', status: 'DISPLAYED', value: '' },
      { id: 'nice-2-have', status: 'VALUE_CHANGED', value: 'something' },
      { id: '', status: 'VALUE_CHANGED', value: 'anything' }
    ]));

    await send({ type: 'vopNavigationDeniedNotification', sessionId: '1', reason: ['responsesIncomplete'] });
    await driver.sleep(60);

    const vspMessage = await driver.findElement(By.css('vsp-message'));

    const vspMessageLinks = await vspMessage.findElements(By.css('[onclick]'));
    expect(vspMessageLinks.length).toEqual(1);

    await mustHave.sendKeys('whatever');

    message = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification', 1500);
    expect(message.unitState.responseProgress).toEqual('complete');
    expect(message.unitState.dataParts.answers).toEqual(JSON.stringify([
      { id: 'must-have', status: 'VALUE_CHANGED', value: 'whatever' },
      { id: 'nice-2-have', status: 'VALUE_CHANGED', value: 'something' },
      { id: '', status: 'VALUE_CHANGED', value: 'anything' }
    ]));
  });

  it('should send the correct `presentationProgress` in paginated mode', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<fieldset><legend id="p1">Page 1</legend></fieldset><fieldset><legend id="p2">Page 2</legend></fieldset>',
      sessionId: '1',
      playerConfig: {
        pagingMode: 'button'
      }
    });

    await MessageRecorder.recordMessages(driver);

    const nextPage = await driver.findElement(By.css('#next-page'));

    const message1 = await VopState.get(driver);

    await nextPage.click();

    await driver.sleep(100);

    const message2 = await VopState.get(driver);

    expect(message1.unitState.presentationProgress).toEqual('some');
    expect(message2.unitState.presentationProgress).toEqual('complete');
  });

  it('should send the correct presentationProgress if extended', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <fieldset>
            <legend id='p1'>Page 1</legend>
            <div id='special' onclick="increaseSpecialPresentationProgress()">0</div>
        </fieldset>
        <fieldset><legend id='p2'>Page 2</legend></fieldset>
        <script>
            let specialPresentationProgress = 0;
            const increaseSpecialPresentationProgress = () => {
                specialPresentationProgress++;
                document.getElementById('special').innerText = specialPresentationProgress.toString(10);
            };
            Unit.presentationProgressFactors.special = {
                some: () => specialPresentationProgress < 2 && specialPresentationProgress > 0,
                complete: () => specialPresentationProgress > 2
            };
        </script>`,
      sessionId: '1',
      playerConfig: {
        pagingMode: 'button'
      }
    });

    const nextPage = await driver.findElement(By.css('#next-page'));
    // const prevPage = await driver.findElement(By.css('#previous-page'));
    const special = await driver.findElement(By.css('#special'));

    const message1 = await VopState.get(driver);

    await special.click(); // sppb = 1

    const message2 = await VopState.get(driver);

    await special.click(); // sppb = 2

    const message3 = await VopState.get(driver);

    await special.click(); // sppb = 3

    const message4 = await VopState.get(driver);

    await nextPage.click();

    const message5 = await VopState.get(driver);

    expect(message1.unitState.presentationProgress).toEqual('some');
    expect(message2.unitState.presentationProgress).toEqual('some');
    expect(message3.unitState.presentationProgress).toEqual('some');
    expect(message4.unitState.presentationProgress).toEqual('some');
    expect(message5.unitState.presentationProgress).toEqual('complete');
  });

  it('should send the correct `presentationProgress` when there are no pages', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
          Long Story, Chapter one ${longText()}
          <hr id="the-middle">
          Long Story, Chapter two ${longText()}
      `,
      sessionId: '1',
      playerConfig: {
        pagingMode: 'separate'
      }
    });

    const theMiddle = await driver.findElement(By.css('#the-middle'));
    const unit = await driver.findElement(By.css('#unit'));

    await driver.executeScript(e => e.scrollIntoView(), theMiddle);

    const message1 = await VopState.get(driver);

    await driver.executeScript(e => e.scrollTo(0, e.scrollHeight), unit);
    await driver.sleep(50); // give player time to detect changed presentationProgress

    const message2 = await VopState.get(driver);

    expect(message1.unitState.presentationProgress).toEqual('some');
    expect(message2.unitState.presentationProgress).toEqual('complete');
  });

  it('should send the correct `presentationProgress` and `currentPage` in scroll-mode', async () => {
    await loadPlayer({
      debounceStateMessages: 25 // don't set debounce time completely to zero, since page detection relies on it
    });

    await MessageRecorder.recordMessages(driver);

    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <fieldset>${longText(2000)}</fieldset>
        <fieldset>${longText(1000)}</fieldset>
        <fieldset>${longText(25)}</fieldset>
        <fieldset>${longText(2000)}</fieldset>`,
      sessionId: '1',
      playerConfig: {
        pagingMode: 'concat-scroll'
      }
    });

    const messages = [await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification')];

    const unit = await driver.findElement(By.css('#unit'));

    const scrollPoints = [80, 30, 90, 55, 70, 50];

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const point in scrollPoints) {
      // eslint-disable-next-line no-await-in-loop
      await driver.executeScript(
        (a, b) => a.scrollTo(0, b * (unit.scrollHeight / 100)),
        unit,
        scrollPoints[point]
      );
      // eslint-disable-next-line no-await-in-loop
      messages.push(await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification'));
    }

    const pageAndProgress = messages.map(niceMsg => [
      (niceMsg.playerState) ? niceMsg.playerState.currentPage : '-',
      (niceMsg.unitState) ? niceMsg.unitState.presentationProgress : '-'
    ]);

    expect(pageAndProgress).toEqual([
      ['1', 'some'],
      ['4', '-'],
      ['1', '-'],
      ['4', '-'],
      ['3', '-'],
      ['4', '-'],
      ['2', 'complete']
    ]);
  });

  it('should send the correct `presentationProgress` in scroll-snap-mode', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <fieldset id="p1">${longText()}</fieldset>
        <fieldset id="p2">${longText()}</fieldset>
        <fieldset id="p3">${longText()}</fieldset>`,
      sessionId: '1',
      playerConfig: {
        pagingMode: 'concat-scroll-snap'
      }
    });

    const unit = await driver.findElement(By.css('#unit'));

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < 20; i++) {
      unit.sendKeys(Key.PAGE_DOWN); // scrollTo in combination with snap-scroll skips foot-anchor-points
    }

    const message1 = await VopState.get(driver);

    expect(message1.unitState.presentationProgress).toEqual('some');

    // TODO complete
  });

  describe('logger', () => {
    it('should log everything when in debug mode', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'debug'
        },
        unitDefinitionType: 'iqb-simple-html@1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      const msg = await VopState.get(driver);

      expect(msg.log[0].key).toEqual('rich');
      expect(msg.log[1].key).toEqual('lean');
      expect(msg.log[2].key).toEqual('debug');
    });

    it('should log rich & lean when in rich mode', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'rich'
        },
        unitDefinitionType: 'iqb-simple-html@1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      const msg = await VopState.get(driver);

      expect(msg.log[0].key).toEqual('rich');
      expect(msg.log[1].key).toEqual('lean');
      expect(msg.log.length).toEqual(2);
    });

    it('should log only lean when in lean mode', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'lean'
        },
        unitDefinitionType: 'iqb-simple-html@1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      const msg = await VopState.get(driver);

      expect(msg.log[0].key).toEqual('lean');
      expect(msg.log.length).toEqual(1);
    });

    it('should not log only lean when logging is disabled', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'disabled'
        },
        unitDefinitionType: 'iqb-simple-html@1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      const msg = await VopState.get(driver);

      expect(msg.log).toBeUndefined();
    });
  });

  describe('(regression tests)', () => {
    it('should prevent implicit form submission', async () => {
      // see: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#default-button
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <input id='input' type="text">
          <button onclick="document.querySelector('form').innerHTML='button-clicked-by-implicit-submission'">
            B
          </button>`,
        sessionId: '1'
      });

      const form = await driver.findElement(By.css('form'));
      const input = await driver.findElement(By.id('input'));

      await input.sendKeys('xxx', Key.ENTER);

      expect(await form.getText()).not.toEqual('button-clicked-by-implicit-submission');
    });

    it('can show it\'s own metadata', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition:
          '<div id="go" onclick=\'document.querySelector("#unit").appendChild(PlayerUI.getPlayerInfoHTML())\'>I</div>',
        sessionId: '1',
        playerConfig: {
          logPolicy: 'disabled'
        }
      });

      const showButton = driver.findElement(By.id('go'));
      await showButton.click();
      const vspMeta = driver.findElement(By.id('vsp-meta'));
      expect(await vspMeta.isDisplayed()).toBeTrue();
    });
  });

  describe('(verona 4)', () => {
    it('should send the whole metadata with vopReadyNotification', async () => {
      await loadPlayer({ delayReadyNotification: 100 });
      await MessageRecorder.recordMessages(driver);
      const msg = await MessageRecorder.getLastMessage(driver, 'vopReadyNotification');
      expect(msg.metadata.type).toEqual('player');
      expect(msg.metadata.id).toEqual('verona-player-simple');
      expect(msg.metadata.code.repositoryUrl).toEqual('https://github.com/iqb-berlin/verona-player-simple');
    });
  });

  describe('(verona 5.1)', () => {
    const unitWithPagesAndManyInputs = `
      <fieldset>
        <label><input name="required-text-field" required />Required Textfield </label><br>
        <label><input name="readonly-text-field" value="read-only" readonly />Read-Only Textfield </label><br>
        <label><input name="text-field" />Textfield </label><br>
        <label><input type="radio" name="text-field" value="x" />Radio Button </label><br>
        <label><input type="number" min="2" max="4" name="number-field" />Number field </label><br>
        <label><input type="date" name="date-field" />Date field </label><br>
        <label><input type="email" name="email-field" />Email field </label><br>
        <label><input type="checkbox" name="check-box" />Checkbox </label><br>
      </fieldset>
      <fieldset>
        Page 2
        <label>
          Dropdown
          <select name="select-box">
            <option value="a">A</option>
          </select>
        </label>
        <label>
          Textarea
          <textarea name="text-area" style="width: 100%">Type something...</textarea>
        </label>
        <a href="https://github.com/iqb-berlin/testcenter/">A Link</a>
      </fieldset>
      <fieldset>Page 3</fieldset>
      <fieldset>Page 4</fieldset>
    `;
    it('should break pages printMode=on', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: unitWithPagesAndManyInputs,
        sessionId: '1',
        playerConfig: {
          printMode: 'on-with-ids'
        }
      });
      const style = await ComputedStyle.get(driver, '#unit fieldset', ['break-after']);
      expect(style).toEqual([['page', 'page', 'page', 'page']]);
    });
    it('should show names printMode=on-with-ids', async () => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: unitWithPagesAndManyInputs,
        sessionId: '1',
        playerConfig: {
          printMode: 'on-with-ids'
        }
      });
      const style = await ComputedStyle.get(driver, 'vsp-namehint', ['visibility']);
      expect(style).toEqual([[
        'visible', 'visible',
        'visible', 'visible',
        'visible', 'visible',
        'visible', 'visible',
        'visible', 'visible'
      ]]);
    });
  });

  it('should be possible to reuse it', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: '<div id="title">first unit</div>',
      sessionId: '1'
    });
    const title1 = await driver.findElement(By.id('title'));
    expect(await title1.getText()).toEqual('first unit');
    await send({
      type: 'vopStartCommand',
      unitDefinition: '<div id="title">second unit</div>',
      sessionId: '2'
    });
    const title2 = await driver.findElement(By.id('title'));
    expect(await title2.getText()).toEqual('second unit');
  });

  it('should not accept calls with wrong sessionId', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: '<fieldset id="p1">page 1</fieldset><fieldset>page 2</fieldset><fieldset>page 3</fieldset>',
      sessionId: '1'
    });
    await driver.findElement(By.id('p1'));
    await send({
      type: 'vopPageNavigationCommand',
      target: '2',
      sessionId: '1'
    });
    const state1 = await VopState.get(driver);
    expect(state1.playerState.currentPage).toEqual('2');
    await send({
      type: 'vopPageNavigationCommand',
      target: '3',
      sessionId: 'wrong'
    });
    const state2 = await VopState.get(driver);
    expect(state2.playerState.currentPage).toEqual('2');
  });

  it('should return data in IQB standard', async () => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        `<fieldset id="p1">
           <h1>page 1</h1>
            <input type="text" name="a_text" /><br />
            <input type="number" name="a_number" /><br />
            <input type="checkbox" name="a_checkbox" /><br />
            <label><input type="radio" name="a_radio" value="a" />A</label>
            <label><input type="radio" name="a_radio" value="b" />B</label><br />
            <input type="range" name="a_range" min="0" max="10" /><br />
            <textarea name="a_textarea"></textarea><br />
            <div name="a_contenteditable" contenteditable></div>
            <input type="text" name="a_second_text"/><br />
            <input type="text" name="a_second_text" id="duplicate_name"/><br />
            <select name="a_select">
              <option value="one" selected>1</option>
              <option value="two">2</option>
            </select>
            <div style="height: 1000px; text-align: center; padding-top: 3em">↓</div>
            <label><input name="a_hidden_text_field" value="initial" />Hidden Text field </label><br>
        </fieldset>
        <fieldset>
          <p><b>Page 2</b></p>
          <label><input name="a_text_field_on_page_two" value="initial" />Text field page two</label><br>
        </fieldset>`,
      sessionId: '1',
      unitState: {
        unitStateDataType: 'iqb-standard@1.0',
        dataParts: {
          answers: JSON.stringify([{ id: 'a_text', status: 'VALUE_CHANGED', value: 'loaded' }])
        }
      }
    });

    await driver.sleep(100);

    expect(await VopState.getAnswers(driver)).toEqual([
      { id: 'a_text', status: 'VALUE_CHANGED', value: 'loaded' },
      { id: 'a_number', status: 'DISPLAYED', value: '' },
      { id: 'a_checkbox', status: 'DISPLAYED', value: '' },
      { id: 'a_radio', status: 'DISPLAYED', value: '' },
      { id: 'a_range', status: 'DISPLAYED', value: '5' },
      { id: 'a_textarea', status: 'DISPLAYED', value: '' },
      { id: 'a_contenteditable', status: 'DISPLAYED', value: '' },
      { id: 'a_second_text', status: 'DISPLAYED', value: ['', ''] },
      { id: 'a_select', status: 'DISPLAYED', value: 'one' },
      { id: 'a_hidden_text_field', status: 'NOT_REACHED', value: 'initial' },
      { id: 'a_text_field_on_page_two', status: 'NOT_REACHED', value: 'initial' }
    ]);

    await driver.findElement(By.name('a_text')).sendKeys('A');
    await driver.findElement(By.name('a_number')).sendKeys(9);
    await driver.findElement(By.name('a_checkbox')).click();
    await driver.findElement(By.name('a_range')).sendKeys(Key.ARROW_LEFT, Key.ARROW_LEFT);
    await driver.findElement(By.name('a_radio')).click();
    await driver.findElement(By.name('a_textarea')).sendKeys('sth');
    await driver.findElement(By.name('a_contenteditable')).sendKeys('sth2');
    await driver.findElement(By.name('a_second_text')).sendKeys('xx');
    await driver.findElement(By.id('duplicate_name')).sendKeys('yy');
    const selectElement = await driver.findElement(By.name('a_select'));
    const select = new Select(selectElement);
    await select.selectByValue('two');

    expect(await VopState.getAnswers(driver)).toEqual([
      { id: 'a_text', status: 'VALUE_CHANGED', value: 'loadedA' },
      { id: 'a_number', status: 'VALUE_CHANGED', value: '9' },
      { id: 'a_checkbox', status: 'VALUE_CHANGED', value: 'on' },
      { id: 'a_radio', status: 'VALUE_CHANGED', value: 'a' },
      { id: 'a_range', status: 'VALUE_CHANGED', value: '3' },
      { id: 'a_textarea', status: 'VALUE_CHANGED', value: 'sth' },
      { id: 'a_contenteditable', status: 'VALUE_CHANGED', value: 'sth2' },
      { id: 'a_second_text', status: 'VALUE_CHANGED', value: ['xx', 'yy'] },
      { id: 'a_select', status: 'VALUE_CHANGED', value: 'two' },
      { id: 'a_hidden_text_field', status: 'NOT_REACHED', value: 'initial' },
      { id: 'a_text_field_on_page_two', status: 'NOT_REACHED', value: 'initial' }
    ]);

    const hiddenTextField = await driver.findElement(By.name('a_hidden_text_field'));
    await driver.executeScript(e => e.scrollIntoView(), hiddenTextField);

    expect(await VopState.getAnswer(driver, 'a_hidden_text_field'))
      .toEqual({ id: 'a_hidden_text_field', status: 'DISPLAYED', value: 'initial' });

    const nextPage = await driver.findElement(By.css('#next-page'));
    await nextPage.click();

    expect(await VopState.getAnswer(driver, 'a_text_field_on_page_two'))
      .toEqual({ id: 'a_text_field_on_page_two', status: 'DISPLAYED', value: 'initial' });

    const prevPage = await driver.findElement(By.css('#prev-page'));
    await prevPage.click();

    await driver.findElement(By.name('a_checkbox')).click();
    expect(await VopState.getAnswer(driver, 'a_checkbox'))
      .toEqual({ id: 'a_checkbox', status: 'VALUE_CHANGED', value: '' });
  });
});
