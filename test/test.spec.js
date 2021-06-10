/* eslint-disable no-undef */ // TODO find a solution to import it, describe etc. in a way eslint can see
require('selenium-webdriver');
const jasmine = require('jasmine');
const { Options } = require('selenium-webdriver/firefox');
const { Builder, By, Key } = require('selenium-webdriver');
const { MessageRecorder } = require('iqb-dev-components');
const testConfig = require('./config.json');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000; // firefox is starting too slow sometimes (1 of 750 times on my machine)
MessageRecorder.defaultWaitingTime = 500;

let driver;

const options = new Options();
if (testConfig.headless) {
  options.addArguments('-headless');
}

const playerPath = `${__dirname}/../verona-simple-player-1.html`;

const send = async message => {
  await driver.executeScript(`window.postMessage(${JSON.stringify(message)}, '*');`);
};

const loadPlayer = async playerSettings => {
  const query = playerSettings
    ? Object.keys(playerSettings).reduce((carry, item) => `${carry}&${item}=${playerSettings[item]}`, '?')
    : '';

  await driver.get(`file:${playerPath}${query}`);
};

describe('simple player', () => {
  beforeAll(async done => {
    driver = await new Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(options)
      .build();
    done();
  });

  beforeEach(async done => {
    await loadPlayer();
    done();
  });

  afterAll(async done => {
    if (!testConfig.keepOpen) {
      await driver.quit();
    }
    done();
  });

  it('should load an unit on `vopStartCommand`', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: '<h1>Virtual Unit</h1>',
      sessionId: '1'
    });

    const title = await driver.findElement(By.css('h1'));

    expect(await title.getText()).toBe('Virtual Unit');

    done();
  });

  it('should block unit on `vopStopCommand` and continue on `vopContinueCommand`', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<h1>Virtual Unit</h1><input name='field'>",
      sessionId: '1'
    });

    await send({
      type: 'vopStopCommand',
      sessionId: '1'
    });

    const input = await driver.findElement(By.css('input[name="field"]'));

    try {
      await input.click();
      fail('should not be clickable anymore');
    } catch (exception) {
      expect(exception.name).toEqual('ElementClickInterceptedError');
    }

    await send({
      type: 'vopContinueCommand',
      sessionId: '1'
    });

    try {
      await input.click();
    } catch (exception) {
      fail('should not be clickable again');
    }

    done();
  });

  it('ignore command, when sessionId is wrong', async done => {
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
    done();
  });

  it('should display paginated unit when pages are available and `pagingMode` = `separate`', async done => {
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

    expect(await nextPage.isDisplayed()).toBeTrue();
    expect(await prevPage.isDisplayed()).toBeTrue();

    expect(await p1.isDisplayed()).toBeTrue();
    expect(await p2.isDisplayed()).toBeFalse();
    expect(await nextPage.isEnabled()).toBeTrue();
    expect(await prevPage.isEnabled()).toBeFalse();

    await nextPage.click();

    expect(await p1.isDisplayed()).toBeFalse();
    expect(await p2.isDisplayed()).toBeTrue();
    expect(await nextPage.isEnabled()).toBeFalse();
    expect(await prevPage.isEnabled()).toBeTrue();

    await prevPage.click();

    expect(await p1.isDisplayed()).toBeTrue();
    expect(await p2.isDisplayed()).toBeFalse();
    expect(await nextPage.isEnabled()).toBeTrue();
    expect(await prevPage.isEnabled()).toBeFalse();

    done();
  });

  it('should not display pagination buttons when `pagingMode` = `concat-scroll`', async done => {
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

    done();
  });

  it('should not display pagination buttons when `pagingMode` = `concat-scroll-snap`', async done => {
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

    done();
  });

  it('should load values into the right forms', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: '<input type="text" /><input type="text" name="field" /><p contenteditable></p>',
      sessionId: '1',
      unitState: {
        dataParts: {
          all: {
            answers: {
              '': ['firstContent', 'thirdContent'],
              field: 'secondContent'
            }
          }
        }
      }
    });

    const input1 = await driver.findElement(By.css('#unit input:nth-of-type(1)'));
    const input2 = await driver.findElement(By.css('#unit input:nth-of-type(2)'));
    const input3 = await driver.findElement(By.css('#unit p'));

    expect(await input1.getAttribute('value')).toEqual('firstContent');
    expect(await input2.getAttribute('value')).toEqual('secondContent');
    expect(await input3.getText()).toEqual('thirdContent');

    done();
  });

  it('should collect values from form', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        `<input type="text" name="field" value="a" />
        <input type="text" name="field" value="b" /><p contenteditable>c</p>`,
      sessionId: '1',
      playerConfig: {
        stateReportPolicy: 'on-demand'
      }
    });

    await MessageRecorder.recordMessages(driver);

    await send({
      type: 'vopGetStateRequest',
      sessionId: '1'
    });

    const msg = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse', 1000);

    expect(msg.unitState.dataParts.all.answers || {}).toEqual({
      '': 'c',
      field: ['a', 'b']
    });

    done();
  });

  it('should support various form elements', async done => {
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
          all: {
            answers: {
              'check-box-a': 'on',
              'radio-group': 'b',
              'multi-select': ['b', 'c']
            }
          }
        }
      }
    });

    const textArea = await driver.findElement(By.css('[name="text-area"]'));
    const multiSelectA = await driver.findElement(By.css('[name="multi-select"] [value="a"]'));
    const multiSelectB = await driver.findElement(By.css('[name="multi-select"] [value="b"]'));
    const radioGroupA = await driver.findElement(By.css('[name="radio-group"][value="a"]'));
    const checkBoxA = await driver.findElement(By.css('[name="check-box-a"]'));
    const checkBoxB = await driver.findElement(By.css('[name="check-box-b"]'));

    await MessageRecorder.recordMessages(driver, 'vopStateChangedNotification');

    textArea.sendKeys('text area content');
    multiSelectA.click();

    await multiSelectA.click();
    await driver.actions() // TODO DOES NOT WORK
      .move(multiSelectB)
      .keyDown(Key.SHIFT)
      .click()
      .keyUp(Key.SHIFT)
      .perform();

    await radioGroupA.click();

    await checkBoxA.click();
    await checkBoxB.click();

    const msg = await MessageRecorder.getLastMessage(driver, 'vopStateChangedNotification');

    expect(msg.unitState.dataParts.all.answers || {}).toEqual({
      'text-area': 'text area content',
      'multi-select': ['c'],
      'radio-group': 'a',
      'check-box-b': 'on'
    });

    done();
  });

  it('should collect values from element from extension', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <script>
          let special = false;
          Unit.dataPartsCollectors.special = () => special ? 'yes' : 'no';
          PlayerUI.addEventListener('click', '#specialControl', () => {
              special = true;
          });
        </script>
        <div id="specialControl">X</div>
    `,
      sessionId: '1',
      playerConfig: {
        stateReportPolicy: 'on-demand'
      }
    });

    const specialControl = await driver.findElement(By.css('#specialControl'));

    await MessageRecorder.recordMessages(driver);

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message1 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    await specialControl.click();

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message2 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    expect(message1.unitState.dataParts.all).toEqual({
      answers: {},
      special: 'no'
    });

    expect(message2.unitState.dataParts.all).toEqual({
      answers: {},
      special: 'yes'
    });

    done();
  });

  it('should collect values even if there are changed programmatically', async done => {
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

    expect(message1.unitState.dataParts.all.answers || {}).toEqual({
      field: 'manually changed'
    });

    expect(message2.unitState.dataParts.all.answers || {}).toEqual({
      field: 'programmatically changed'
    });

    done();
  });

  it('debounce returning messages', async done => {
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

    expect(message2.unitState.dataParts.all.answers || {}).toEqual({
      field: 'first input second input'
    });

    done();
  });

  it('should execute script in unit', async done => {
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
    done();
  });

  it('should apply style in unit', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<style>#thing {background-color: rgb(143, 188, 143)}</style><p id="thing">should be green</p>',
      sessionId: '1'
    });

    const thing = await driver.findElement(By.css('#thing'));

    expect(await thing.getCssValue('background-color')).toEqual('rgb(143, 188, 143)');
    done();
  });

  describe('unit navigation', () => {
    it('should enable next if available', async done => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: '<h1>Virtual Unit</h1>',
        sessionId: '1',
        playerConfig: {
          unitNumber: 1,
          unitCount: 4
        }
      });

      const nextUnit = await driver.findElement(By.css('#next-unit'));
      const prevUnit = await driver.findElement(By.css('#prev-unit'));
      const lastUnit = await driver.findElement(By.css('#last-unit'));
      const firstUnit = await driver.findElement(By.css('#first-unit'));

      expect(await nextUnit.isEnabled()).toBeTrue();
      expect(await prevUnit.isEnabled()).toBeFalse();
      expect(await lastUnit.isEnabled()).toBeTrue();
      expect(await firstUnit.isEnabled()).toBeFalse();

      done();
    });

    it('should enable previous if available', async done => {
      await driver.get(`file:${playerPath}`);

      await send({
        type: 'vopStartCommand',
        unitDefinition: '<h1>Virtual Unit</h1>',
        sessionId: '1',
        playerConfig: {
          unitNumber: 4,
          unitCount: 4
        }
      });

      const nextUnit = await driver.findElement(By.css('#next-unit'));
      const prevUnit = await driver.findElement(By.css('#prev-unit'));
      const lastUnit = await driver.findElement(By.css('#last-unit'));
      const firstUnit = await driver.findElement(By.css('#first-unit'));

      expect(await nextUnit.isEnabled()).toBeFalse();
      expect(await prevUnit.isEnabled()).toBeTrue();
      expect(await lastUnit.isEnabled()).toBeFalse();
      expect(await firstUnit.isEnabled()).toBeTrue();

      done();
    });

    it('should enable both if available', async done => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: '<h1>Virtual Unit</h1>',
        sessionId: '1',
        playerConfig: {
          unitNumber: 2,
          unitCount: 4
        }
      });

      const nextUnit = await driver.findElement(By.css('#next-unit'));
      const prevUnit = await driver.findElement(By.css('#prev-unit'));
      const lastUnit = await driver.findElement(By.css('#last-unit'));
      const firstUnit = await driver.findElement(By.css('#first-unit'));

      expect(await nextUnit.isEnabled()).toBeTrue();
      expect(await prevUnit.isEnabled()).toBeTrue();
      expect(await lastUnit.isEnabled()).toBeTrue();
      expect(await firstUnit.isEnabled()).toBeTrue();

      done();
    });
  });

  it('should support `stateReportPolicy` = `on-demand`', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input id='the-item' name='the-item' type='text'/>",
      sessionId: '1',
      playerConfig: {
        stateReportPolicy: 'on-demand'
      }
    });

    await MessageRecorder.recordMessages(driver);

    const input = await driver.findElement(By.css('#the-item'));
    await input.sendKeys('something');

    let msg = await MessageRecorder.getLastMessage(driver);

    expect(msg).toBeNull();

    await send({
      type: 'vopGetStateRequest',
      sessionId: '1'
    });

    msg = await MessageRecorder.getLastMessage(driver);

    if (typeof msg !== 'object' || msg == null) {
      fail('message must be an object');
    }

    msg.timeStamp = NaN;

    expect(msg).toEqual({
      sessionId: '1',
      timeStamp: NaN,
      type: 'vopGetStateResponse',
      unitState: {
        dataParts: {
          all: {
            answers: {
              'the-item': 'something'
            }
          }
        },
        presentationProgress: 'complete',
        responseProgress: 'complete-and-valid'
      },
      playerState: {
        currentPage: 0,
        validPages: { 0: '' }
      },
      unitStateDataTyp: 'verona-simple-player-1.0.0'
    });

    done();
  });

  it('should support `stateReportPolicy` = `eager`', async done => {
    await loadPlayer({
      debounceStateMessages: 150,
      debounceKeyboardEvents: 0
    });

    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input id='the-item' name='the-item' type='text'/>",
      sessionId: '1',
      playerConfig: {
        stateReportPolicy: 'eager'
      }
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
          all: {
            answers: {
              'the-item': 'something'
            }
          }
        },
        presentationProgress: 'complete',
        responseProgress: 'complete-and-valid'
      },
      playerState: {
        currentPage: 0,
        validPages: { 0: '' }
      },
      unitStateDataTyp: 'verona-simple-player-1.0.0'
    });

    done();
  });

  it('should send `vopWindowFocusChangedNotification` on focus change', async done => {
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

    done();
  });

  it('should send the correct responseProgress', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input type='number' name='first' /><input type='number' name='second' />",
      sessionId: '1',
      playerConfig: {
        stateReportPolicy: 'on-demand'
      }
    });

    const first = await driver.findElement(By.css('[name="first"]'));
    const second = await driver.findElement(By.css('[name="second"]'));

    await MessageRecorder.recordMessages(driver);

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    expect((await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse')).unitState.responseProgress)
      .toEqual('none');

    await first.sendKeys('not a number');
    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    expect((await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse')).unitState.responseProgress)
      .toEqual('some');

    await second.sendKeys('1');
    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    expect((await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse')).unitState.responseProgress)
      .toEqual('complete');

    await first.clear();
    await first.sendKeys('1');
    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const msg = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    expect((msg).unitState.responseProgress).toEqual('complete-and-valid');

    done();
  });

  it('should send the correct responseProgress on programmatically changed fields', async done => {
    await send({
      type: 'vopStartCommand',
      unitDefinition: "<input type='text' name='field' />",
      sessionId: '1',
      playerConfig: {
        stateReportPolicy: 'on-demand'
      }
    });

    await MessageRecorder.recordMessages(driver);

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message1 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');
    expect(message1.unitState.responseProgress).toEqual('none');

    await driver.executeScript(() => {
      document.querySelector('[name="field"]').value = 'programmatically changed value!';
    });

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message2 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');
    expect(message2.unitState.responseProgress).toEqual('complete-and-valid');

    done();
  });

  it('should send the correct `presentationProgress` in paginated mode', async done => {
    await loadPlayer({
      debounceStateMessages: 0,
      debounceKeyboardEvents: 0
    });

    await send({
      type: 'vopStartCommand',
      unitDefinition:
        '<fieldset><legend id="p1">Page 1</legend></fieldset><fieldset><legend id="p2">Page 2</legend></fieldset>',
      sessionId: '1',
      playerConfig: {
        pagingMode: 'separate',
        stateReportPolicy: 'on-demand'
      }
    });

    await MessageRecorder.recordMessages(driver);

    const nextPage = await driver.findElement(By.css('#next-page'));

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message1 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    await nextPage.click();

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message2 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    expect(message1.unitState.presentationProgress).toEqual('some');
    expect(message2.unitState.presentationProgress).toEqual('complete');

    done();
  });

  it('should send the correct presentationProgress if extended', async done => {
    await loadPlayer({
      debounceStateMessages: 0,
      debounceKeyboardEvents: 0
    });

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
        pagingMode: 'separate',
        stateReportPolicy: 'on-demand'
      }
    });

    await MessageRecorder.recordMessages(driver);

    const nextPage = await driver.findElement(By.css('#next-page'));
    // const prevPage = await driver.findElement(By.css('#previous-page'));
    const special = await driver.findElement(By.css('#special'));

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message1 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    await special.click(); // sppb = 1

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message2 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    await special.click(); // sppb = 2

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message3 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    await special.click(); // sppb = 3

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message4 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    await nextPage.click();

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message5 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    expect(message1.unitState.presentationProgress).toEqual('some');
    expect(message2.unitState.presentationProgress).toEqual('some');
    expect(message3.unitState.presentationProgress).toEqual('some');
    expect(message4.unitState.presentationProgress).toEqual('some');
    expect(message5.unitState.presentationProgress).toEqual('complete');

    done();
  });

  it('should send the correct `presentationProgress` when there are no pages', async done => {
    const longText = () => Array.from(
      { length: 2000 },
      (_, i) => Array.from({ length: 3 + (i % 10) }, () => 'x').join('')
    ).join(' ');

    await send({
      type: 'vopStartCommand',
      unitDefinition: `
          Long Story, Chapter one ${longText()}
          <hr id="the-middle">
          Long Story, Chapter two ${longText()}
      `,
      sessionId: '1',
      playerConfig: {
        pagingMode: 'separate',
        stateReportPolicy: 'on-demand'
      }
    });

    const theMiddle = await driver.findElement(By.css('#the-middle'));
    const unit = await driver.findElement(By.css('#unit'));

    await MessageRecorder.recordMessages(driver);

    await driver.executeScript(e => e.scrollIntoView(), theMiddle);

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message1 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    await driver.executeScript(e => e.scrollTo(0, e.scrollHeight), unit);
    await driver.sleep(50); // give player time to detect changed presentationProgress

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message2 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    expect(message1.unitState.presentationProgress).toEqual('some');
    expect(message2.unitState.presentationProgress).toEqual('complete');
    done();
  });

  it('should send the correct `presentationProgress` and `currentPage` in scroll-mode', async done => {
    await loadPlayer({
      debounceStateMessages: 25 // don't set debounce time completely to zero, since page detection relies on it
    });

    const longText = length => Array.from(
      { length },
      (_, i) => Array.from({ length: 3 + (i % 10) }, () => 'x').join('')
    ).join(' ');

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

    done();
  });

  it('should send the correct `presentationProgress` in scroll-snap-mode', async done => {
    await loadPlayer({
      debounceStateMessages: 0,
      debounceKeyboardEvents: 0
    });

    const longText = () => Array.from(
      { length: 2000 },
      (_, i) => Array.from({ length: 3 + (i % 10) }, () => 'x').join('')
    ).join(' ');

    await send({
      type: 'vopStartCommand',
      unitDefinition: `
        <fieldset id="p1">${longText()}</fieldset>
        <fieldset id="p2">${longText()}</fieldset>
        <fieldset id="p3">${longText()}</fieldset>`,
      sessionId: '1',
      playerConfig: {
        pagingMode: 'concat-scroll-snap',
        stateReportPolicy: 'on-demand'
      }
    });

    const unit = await driver.findElement(By.css('#unit'));

    await MessageRecorder.recordMessages(driver);

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < 20; i++) {
      unit.sendKeys(Key.PAGE_DOWN); // scrollTo in combination with snap-scroll skips foot-anchor-points
    }

    await send({ type: 'vopGetStateRequest', sessionId: '1' });
    const message1 = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

    expect(message1.unitState.presentationProgress).toEqual('some');

    // TODO complete

    done();
  });

  describe('logger', () => {
    it('should log everything when in debug mode', async done => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'debug',
          stateReportPolicy: 'on-demand'
        },
        unitDefinitionType: 'verona-simple-player-1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await MessageRecorder.recordMessages(driver);

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      await send({ type: 'vopGetStateRequest', sessionId: '1' });

      const msg = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

      expect(msg.log[0].key).toEqual('rich');
      expect(msg.log[1].key).toEqual('lean');
      expect(msg.log[2].key).toEqual('debug');
      done();
    });

    it('should log rich & lean when in rich mode', async done => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'rich',
          stateReportPolicy: 'on-demand'
        },
        unitDefinitionType: 'verona-simple-player-1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await MessageRecorder.recordMessages(driver);

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      await send({ type: 'vopGetStateRequest', sessionId: '1' });

      const msg = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

      expect(msg.log[0].key).toEqual('rich');
      expect(msg.log[1].key).toEqual('lean');
      expect(msg.log.length).toEqual(2);
      done();
    });

    it('should log only lean when in lean mode', async done => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'lean',
          stateReportPolicy: 'on-demand'
        },
        unitDefinitionType: 'verona-simple-player-1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await MessageRecorder.recordMessages(driver);

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      await send({ type: 'vopGetStateRequest', sessionId: '1' });

      const msg = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

      expect(msg.log[0].key).toEqual('lean');
      expect(msg.log.length).toEqual(1);
      done();
    });

    it('should not log only lean when logging is disabled', async done => {
      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <button id="rich" onclick="Log.rich('rich'); return false">R</button>
          <button id="lean" onclick="Log.lean('lean'); return false">L</button>
          <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'disabled',
          stateReportPolicy: 'on-demand'
        },
        unitDefinitionType: 'verona-simple-player-1.0.0'
      });

      const richBtn = await driver.findElement(By.css('#rich'));
      const leanBtn = await driver.findElement(By.css('#lean'));
      const debugBtn = await driver.findElement(By.css('#debug'));

      await MessageRecorder.recordMessages(driver);

      await richBtn.click();
      await leanBtn.click();
      await debugBtn.click();

      await send({ type: 'vopGetStateRequest', sessionId: '1' });

      const msg = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

      expect(msg.log).toBeUndefined();
      done();
    });
  });

  describe('Player (regression tests)', () => {
    it('should prevent implicit form submission', async done => {
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
      done();
    });

    fit('mark a radio-group as touched when on elem of the group is touched', async done => {
      await loadPlayer({
        debounceStateMessages: 0,
        debounceKeyboardEvents: 0
      });

      await send({
        type: 'vopStartCommand',
        unitDefinition: `
          <input type="radio" id="radio_button_1" name="group" value="1" >
          <hr>
          <input type="radio" id="radio_button_2" name="group" value="2">`,
        sessionId: '1',
        playerConfig: {
          logPolicy: 'disabled',
          stateReportPolicy: 'on-demand'
        }
      });

      await MessageRecorder.recordMessages(driver);

      const actions = driver.actions({ async: true });
      await actions
        .move({ origin: driver.findElement(By.id('radio_button_1')) })
        .perform();

      await send({ type: 'vopGetStateRequest', sessionId: '1' });
      const msg = await MessageRecorder.getLastMessage(driver, 'vopGetStateResponse');

      expect(msg.unitState.responseProgress).toEqual('complete');

      done();
    });
  });
});
