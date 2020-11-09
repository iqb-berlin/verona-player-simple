require('selenium-webdriver');

const testConfig = require("./config.json");

const {Options} = require("selenium-webdriver/firefox");
const {Builder, By, Key} = require("selenium-webdriver");

const {recordMessages, getLastMessage} = require('iqb-dev-components');

let driver;

const options = new Options();
if (testConfig.headless) {
    options.addArguments('-headless');
}

const playerPath = __dirname + '/../verona-simple-player-1.html';

const send = async message => {
    await driver.executeScript(`window.postMessage(${JSON.stringify(message)}, '*');`);
}

const loadPlayer = async playerSettings => {
    const query = playerSettings
        ? Object.keys(playerSettings).reduce((carry, item) => carry + `&${item}=${playerSettings[item]}`, '?')
        : '';

    await driver.get('file:' + playerPath + query);
}


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
    })

    afterAll(async done => {
        if (!testConfig.keepOpen) {
            await driver.quit();
        }
        done();
    });

    it('should load unit on `vopStartCommand`', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: "<h1>Virtual Unit</h1>",
            sessionId: "1"
        });

        const title = await driver.findElement(By.css('h1'));
        expect(await title.getText()).toBe('Virtual Unit');

        done();
    });

    it('should block unit on `vopStopCommand` and continue on `vopContinueCommand`', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: "<h1>Virtual Unit</h1><input name='field'>",
            sessionId: "1"
        });

        await send({
            type: "vopStopCommand",
            sessionId: "1"
        });

        const input = await driver.findElement(By.css('input[name="field"]'));

        try {
            await input.click();
            fail("should not be clickable anymore");
        } catch (exception) {
            expect(exception.name).toEqual('ElementClickInterceptedError');
        }

        await send({
            type: "vopContinueCommand",
            sessionId: "1"
        });

        try {
            await input.click();
        } catch (exception) {
            fail("should not be clickable again");
        }

        done();
    });

    it('ignore command, when sessionId is wrong', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: "<h1>Virtual Unit</h1><input name='field'>",
            sessionId: "1"
        });

        await send({
            type: "vopStopCommand",
            sessionId: "wrong"
        });

        const input = await driver.findElement(By.css('input[name="field"]'));

        try {
            await input.click();
        } catch (expection) {
            fail("should still be clickable");
        }
        done();
    });

    it('should display paginated unit when pages are available and `pagingMode` = `separate`', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: "<fieldset><legend id='p1'>Page 1</legend></fieldset><fieldset><legend id='p2'>Page 2</legend></fieldset>",
            sessionId: "1",
            playerConfig: {
                pagingMode: "separate"
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
            type: "vopStartCommand",
            unitDefinition: "<fieldset><legend id='p1'>Page 1</legend></fieldset><fieldset><legend id='p2'>Page 2</legend></fieldset>",
            sessionId: "1",
            playerConfig: {
                pagingMode: "concat-scroll"
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
            type: "vopStartCommand",
            unitDefinition: "<fieldset><legend id='p1'>Page 1</legend></fieldset><fieldset><legend id='p2'>Page 2</legend></fieldset>",
            sessionId: "1",
            playerConfig: {
                pagingMode: "concat-scroll-snap"
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
            type: "vopStartCommand",
            unitDefinition: "<input type='text'/><input type='text' name='field' /><p contenteditable></p>",
            sessionId: "1",
            unitState: {
                dataParts: {
                    all: {
                        answers: {
                            '': ['firstContent', 'thirdContent'],
                            'field': 'secondContent',
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
            type: "vopStartCommand",
            unitDefinition: "<input type='text' name='field' value='a' /><input type='text' name='field' value='b' /><p contenteditable>c</p>",
            sessionId: "1",
            playerConfig: {
                stateReportPolicy: "on-demand"
            }
        });

        await recordMessages(driver);

        await send({
            type: "vopGetStateRequest",
            sessionId: "1"
        });

        const msg = await getLastMessage(driver);

        expect(msg.unitState.dataParts.complete.answers || {}).toEqual({
            '': 'c',
            'field': ['a', 'b'],
        });

        done();
    });

    it('should support various form elements', async done => {

        await loadPlayer({
            debounceStateMessages: 0,
            debounceKeyboardEvents: 0
        });

        await send({
            type: "vopStartCommand",
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
            sessionId: "1",
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
        const multiSelectC = await driver.findElement(By.css('[name="multi-select"] [value="c"]'));
        const radioGroupA = await driver.findElement(By.css('[name="radio-group"][value="a"]'));
        const checkBoxA = await driver.findElement(By.css('[name="check-box-a"]'));
        const checkBoxB = await driver.findElement(By.css('[name="check-box-b"]'));

        await recordMessages(driver);

        textArea.sendKeys('text area content');
        multiSelectA.click();

        await multiSelectA.click();
        await driver.actions()
            .move(multiSelectB)
            .keyDown(Key.SHIFT)
            .click()
            .keyUp(Key.SHIFT)
            .perform();

        await radioGroupA.click();

        await checkBoxA.click();
        await checkBoxB.click();

        const msg = await getLastMessage(driver);

        expect(msg.unitState.dataParts.complete.answers || {}).toEqual({
            'text-area': 'text area content',
            'multi-select': [ 'b', 'c' ],
            'radio-group': 'a',
            'check-box-b': 'on',
        });

        done();
    });



    it ('debounce returning messages', async done => {

        await send({
            type: "vopStartCommand",
            unitDefinition: "<input type='text' name='field' value='' />",
            sessionId: "1",
        });

        const field = await driver.findElement(By.css('[name="field"]'));

        await recordMessages(driver);

        await field.sendKeys('first input'); // debounce 1000

        const message1 = await getLastMessage(driver,100); // wait 100 for message; none should be there

        await field.sendKeys(' second input'); // debounce 1000

        const message2 = await getLastMessage(driver, 1200); // after 1000, message should be sent

        expect(message1).toBeNull();

        expect(message2.unitState.dataParts.complete.answers || {}).toEqual({
            field: 'first input second input',
        });

        done();
    });

    it('should execute script in unit', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: `
                <script>
                    document.addEventListener('vopStartCommand', () =>
                        document.querySelector('#unit p').innerHTML = 'rewritten'
                    );
                </script>
                <p>original</p>`,
            sessionId: "1",
        });

        const unit = await driver.findElement(By.css('#unit p'));

        await unit.click();

        expect(await unit.getText()).toEqual('rewritten');
        done();
    });

    it('should apply style in unit', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: `
                <style>#thing {background-color: rgb(143, 188, 143)}</style><p id="thing">should be green</p>`,
            sessionId: "1",
        });

        const thing = await driver.findElement(By.css('#thing'));

        expect(await thing.getCssValue('background-color')).toEqual('rgb(143, 188, 143)');
        done();
    });

    describe('unit navigation', () => {

        it('should enable next if available', async done => {
            await send({
                type: "vopStartCommand",
                unitDefinition: "<h1>Virtual Unit</h1>",
                sessionId: "1",
                playerConfig: {
                    unitNumber: 1,
                    unitCount: 4,
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
            await driver.get('file:' + playerPath);

            await send({
                type: "vopStartCommand",
                unitDefinition: "<h1>Virtual Unit</h1>",
                sessionId: "1",
                playerConfig: {
                    unitNumber: 4,
                    unitCount: 4,
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
                type: "vopStartCommand",
                unitDefinition: "<h1>Virtual Unit</h1>",
                sessionId: "1",
                playerConfig: {
                    unitNumber: 2,
                    unitCount: 4,
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
            type: "vopStartCommand",
            unitDefinition: "<input id='the-item' name='the-item' type='text'/>",
            sessionId: "1",
            playerConfig: {
                stateReportPolicy: "on-demand"
            }
        });

        await recordMessages(driver);

        const input = await driver.findElement(By.css('#the-item'));
        await input.sendKeys('something');

        let msg = await getLastMessage(driver);

        expect(msg).toBeNull();

        await send({
            type: "vopGetStateRequest",
            sessionId: "1"
        });

        msg = await getLastMessage(driver);

        if (typeof msg !== "object" || msg == null) {
            fail('message must be an object');
        }

        msg['timeStamp'] = NaN;

        expect(msg).toEqual({
            playerState: { currentPage: '1', validPages: {} },
            sessionId: '1',
            timeStamp: NaN,
            type: 'vopGetStateResponse',
            unitState: {
                dataParts: {
                    complete: {
                        answers: {
                            'the-item': 'something'
                        }
                    }
                },
                presentationProgress: 'complete',
                responseProgress: 'complete-and-valid'
            },
            unitStateDataTyp: 'verona-simple-player-1.0.0'
        });

        done();
    });

    it('should support `stateReportPolicy` = `eager`', async done => {

        await loadPlayer({
            debounceStateMessages: 0,
            debounceKeyboardEvents: 0
        });

        await send({
            type: "vopStartCommand",
            unitDefinition: "<input id='the-item' name='the-item' type='text'/>",
            sessionId: "1",
            playerConfig: {
                stateReportPolicy: "eager"
            }
        });

        const input = await driver.findElement(By.css('#the-item'));

        await recordMessages(driver);

        await input.sendKeys('something');
        await driver.sleep(250);

        let msg = await getLastMessage(driver);

        if (typeof msg !== "object" || msg == null) {
            fail('message must be an object');
        }

        msg['timeStamp'] = NaN;

        expect(msg).toEqual({
            playerState: { currentPage: '1', validPages: {} },
            sessionId: '1',
            timeStamp: NaN,
            type: 'vopStateChangedNotification',
            unitState: {
                dataParts: {
                    complete: {
                        answers: {
                            'the-item': 'something'
                        }
                    }
                },
                presentationProgress: 'complete',
                responseProgress: 'complete-and-valid'
            },
            unitStateDataTyp: 'verona-simple-player-1.0.0'
        });

        done();
    });

    it('should send `vopWindowFocusChangedNotification` on focus change', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: "<iframe id='subframe'></iframe><div id='outside'>outside</div>",
            sessionId: "1"
        });

        await recordMessages(driver);

        const subframe = await driver.findElement(By.css('#subframe'));
        await subframe.click();

        let msg = await getLastMessage(driver);

        expect(msg.type).toEqual('vopWindowFocusChangedNotification');
        expect(msg.hasFocus).toBeFalse();

        const player = await driver.findElement(By.css('#outside'));
        await player.click();

        msg = await getLastMessage(driver);

        expect(msg.type).toEqual('vopWindowFocusChangedNotification');
        expect(msg.hasFocus).toBeTrue();

        done();
    });

    // TODO test various input types
    // presentationComplete

    it('should send the correct responseProgress', async done => {
        await send({
            type: "vopStartCommand",
            unitDefinition: "<input type='number' name='first' /><input type='number' name='second' />",
            sessionId: "1",
            playerConfig: {
                stateReportPolicy: "on-demand"
            }
        });

        const first = await driver.findElement(By.css('[name="first"]'));
        const second = await driver.findElement(By.css('[name="second"]'));

        await recordMessages(driver);

        await send({type: "vopGetStateRequest", sessionId: "1"});
        expect((await getLastMessage(driver)).unitState.responseProgress).toEqual('none');

        await first.sendKeys('not a number');
        await send({type: "vopGetStateRequest", sessionId: "1"});
        expect((await getLastMessage(driver)).unitState.responseProgress).toEqual('some');

        await second.sendKeys('1');
        await send({type: "vopGetStateRequest", sessionId: "1"});
        expect((await getLastMessage(driver)).unitState.responseProgress).toEqual('complete');

        await first.clear();
        await first.sendKeys('1');
        await send({type: "vopGetStateRequest", sessionId: "1"});
        expect((await getLastMessage(driver)).unitState.responseProgress).toEqual('complete-and-valid');

        done();
    });

    describe('logger', () => {
        it('should log everything when in debug mode', async done => {
            await send({
                type: "vopStartCommand",
                unitDefinition:
                    `<button id="rich" onclick="Log.rich('rich'); return false">R</button>
                    <button id="lean" onclick="Log.lean('lean'); return false">L</button>
                    <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
                sessionId: "1",
                playerConfig: {
                    logPolicy: "debug",
                    stateReportPolicy: "on-demand"
                },
                unitDefinitionType: "verona-simple-player-1.0.0"
            });

            const richBtn = await driver.findElement(By.css('#rich'));
            const leanBtn = await driver.findElement(By.css('#lean'));
            const debugBtn = await driver.findElement(By.css('#debug'));

            await recordMessages(driver);

            await richBtn.click();
            await leanBtn.click();
            await debugBtn.click();

            await send({type: "vopGetStateRequest", sessionId: "1"});

            const msg = await getLastMessage(driver);

            expect(msg.log[0].key).toEqual('rich');
            expect(msg.log[1].key).toEqual('lean');
            expect(msg.log[2].key).toEqual('debug');
            done();
        });

        it('should log rich & lean when in rich mode', async done => {
            await send({
                type: "vopStartCommand",
                unitDefinition:
                    `<button id="rich" onclick="Log.rich('rich'); return false">R</button>
                    <button id="lean" onclick="Log.lean('lean'); return false">L</button>
                    <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
                sessionId: "1",
                playerConfig: {
                    logPolicy: "rich",
                    stateReportPolicy: "on-demand"
                },
                unitDefinitionType: "verona-simple-player-1.0.0"
            });

            const richBtn = await driver.findElement(By.css('#rich'));
            const leanBtn = await driver.findElement(By.css('#lean'));
            const debugBtn = await driver.findElement(By.css('#debug'));

            await recordMessages(driver);

            await richBtn.click();
            await leanBtn.click();
            await debugBtn.click();

            await send({type: "vopGetStateRequest", sessionId: "1"});

            const msg = await getLastMessage(driver);

            expect(msg.log[0].key).toEqual('rich');
            expect(msg.log[1].key).toEqual('lean');
            expect(msg.log.length).toEqual(2);
            done();
        });

        it('should log only lean when in lean mode', async done => {
            await send({
                type: "vopStartCommand",
                unitDefinition:
                    `<button id="rich" onclick="Log.rich('rich'); return false">R</button>
                    <button id="lean" onclick="Log.lean('lean'); return false">L</button>
                    <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
                sessionId: "1",
                playerConfig: {
                    logPolicy: "lean",
                    stateReportPolicy: "on-demand"
                },
                unitDefinitionType: "verona-simple-player-1.0.0"
            });

            const richBtn = await driver.findElement(By.css('#rich'));
            const leanBtn = await driver.findElement(By.css('#lean'));
            const debugBtn = await driver.findElement(By.css('#debug'));

            await recordMessages(driver);

            await richBtn.click();
            await leanBtn.click();
            await debugBtn.click();

            await send({type: "vopGetStateRequest", sessionId: "1"});

            const msg = await getLastMessage(driver);

            expect(msg.log[0].key).toEqual('lean');
            expect(msg.log.length).toEqual(1);
            done();
        });

        it('should not log only lean when logging is disabled', async done => {
            await send({
                type: "vopStartCommand",
                unitDefinition:
                    `<button id="rich" onclick="Log.rich('rich'); return false">R</button>
                    <button id="lean" onclick="Log.lean('lean'); return false">L</button>
                    <button id="debug" onclick="Log.debug('debug'); return false">D</button>`,
                sessionId: "1",
                playerConfig: {
                    logPolicy: "disabled",
                    stateReportPolicy: "on-demand"
                },
                unitDefinitionType: "verona-simple-player-1.0.0"
            });

            const richBtn = await driver.findElement(By.css('#rich'));
            const leanBtn = await driver.findElement(By.css('#lean'));
            const debugBtn = await driver.findElement(By.css('#debug'));

            await recordMessages(driver);

            await richBtn.click();
            await leanBtn.click();
            await debugBtn.click();

            await send({type: "vopGetStateRequest", sessionId: "1"});

            const msg = await getLastMessage(driver);

            expect(msg.log).toBeUndefined();
            done();
        });
    });
});
