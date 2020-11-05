require('selenium-webdriver');

const testConfig = require("./config.json");
const logging = require("selenium-webdriver/lib/logging");

const {Options} = require("selenium-webdriver/firefox");
const {Builder, By} = require("selenium-webdriver");

let driver;

const options = new Options();
if (testConfig.headless) {
    options.addArguments('-headless');
}

const playerPath = __dirname + '/../verona-simple-player-1.html';

const send = async message => {
    await driver.executeScript(`window.postMessage(${JSON.stringify(message)}, '*');`);
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
        await driver.get('file:' + playerPath);
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

    it ('should load values into the right forms', async done => {
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
});
