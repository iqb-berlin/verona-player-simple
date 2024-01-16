/* eslint-disable import/no-extraneous-dependencies */
// a simple script for developers to run the player with a specific unit and data
const { Options } = require('selenium-webdriver/firefox');
const { Builder } = require('selenium-webdriver');
const fs = require('fs');
const config = require('./config.json');

const path = fs.realpathSync(`${__dirname}/..`);

const playerPath = `${path}/${config.player}`;
const unitPath = `${path}/${config.unit}`;
const unitDataPath = `${path}/${config.data}`;

const sendStartCommand = async driver => {
  const unitData = config.data ? JSON.parse(fs.readFileSync(unitDataPath, 'utf-8').toString()) : {};
  const dataParts = Object.entries(unitData)
    .reduce((agg, entry) => {
      // eslint-disable-next-line no-param-reassign
      agg[entry[0]] = JSON.stringify(entry[1]);
      return agg;
    }, {});
  await driver.executeScript(`window.postMessage(${JSON.stringify({
    type: 'vopStartCommand',
    unitDefinition: fs.readFileSync(unitPath, 'utf-8').toString(),
    sessionId: '1',
    unitState: {
      unitStateDataType: 'iqb-standard@1.0',
      dataParts
    }
  })})`);
};

(async () => {
  const options = new Options();
  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .build();
  await driver.get(`file:${playerPath}`);
  await sendStartCommand(driver);

  fs.watch(path, { recursive: true }, async (eventType, filename) => {
    if (filename && filename.startsWith('.')) {
      await driver.navigate().refresh();
      await sendStartCommand(driver);
    }
  });
})();
