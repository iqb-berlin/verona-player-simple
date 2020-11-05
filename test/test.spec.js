require('selenium-webdriver');

const testConfig = require("./config.json");

const {Options} = require("selenium-webdriver/firefox");
const {Builder, By} = require("selenium-webdriver");

let driver;

let options = new Options();
if (testConfig.headless) {
    options.addArguments('-headless');
}

const playerPath = __dirname + '/../verona-simple-player-1.html';

const send = async message => {
    await driver.executeScript(`window.postMessage(${JSON.stringify(message)});`);
}

describe('basic test', () => {

    beforeAll(async done => {

        driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(options)
            .build();
        done();
    });

    beforeEach(async done => {
        if (!testConfig.keepOpen) {
            await driver.get('file:' + playerPath);
        }
        done();
    })

    afterAll(async done => {
        await driver.quit();
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

    it('block unit on `vopStopCommand` and continue on `vopContinueCommand`', async done => {
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
});
