const fs = require("fs");
const axios = require("axios");
const logger = require("../backend/logger");
const {getCardByUuid, getSet} = require("../backend/data");

const URL = "https://raw.githubusercontent.com/taw/magic-sealed-data/master/sealed_basic_data.json";
const REPO_URL = "https://api.github.com/repos/taw/magic-sealed-data/git/refs/heads/master";
const BOOSTER_RULES_PATH = "data/boosterRules.json";

async function fetch() {
  logger.info("Checking boosterRules repository");
  const repo = await axios.get(REPO_URL);
  const sha = repo.data.object.sha;
  if (fs.existsSync(BOOSTER_RULES_PATH)) {
    const oldRules = JSON.parse(fs.readFileSync(BOOSTER_RULES_PATH, "UTF-8"));
    if (oldRules.repoHash === sha) {
      logger.info("found same boosterRules. Skip new download");
      return;
    }
  }
  logger.info("Downloading new boosterRules");
  const resp = await axios.get(URL);
  const rules = resp.data.reduce((acc, { code, boosters, sheets }) => {
    const totalWeight = boosters.reduce((acc, { weight }) => acc + weight, 0);

    acc[code.toUpperCase()] = {
      totalWeight,
      boosters,
      sheets: Object.entries(sheets).reduce((acc, [code, {balance_colors = false, cards}]) => {
        const totalWeight = Object.values(cards).reduce((acc, val) => acc + val, 0);
        acc[code] = {
          balance_colors,
          totalWeight,
          cards: Object.entries(cards).reduce((acc, [cardCode, weigth]) => {
            const uuid = getUuid(cardCode);
            acc[uuid] = weigth;
            return acc;
          },{}),
          cardsByColor: Object.entries(cards).reduce((acc, [cardCode]) => {
            try {
              const {uuid, colorIdentity, type} = getCard(cardCode);
              if (type === "Land" || colorIdentity.length === 0) {
                (acc["c"] = acc["c"] || []).push(uuid);
              } else {
                colorIdentity.forEach((color) => {
                  (acc[color] = acc[color] || []).push(uuid);
                });
              }
            } catch(err) {
              logger.warn(cardCode + " doesn't match any card");
            }
            return acc;
          },{})
        };
        return acc;
      }, {}),
    };

    return acc;
  }, {});
  rules.repoHash = sha;
  logger.info("Saving boosterRules");
  fs.writeFileSync(BOOSTER_RULES_PATH, JSON.stringify(rules, undefined, 4));
  logger.info("Finished saving boosterRules");
}

const getCard = (cardCode) => {
  const uuid = getUuid(cardCode);
  return getCardByUuid(uuid);
};

const getUuid = (cardCode) => {
  const [setCode, cardNumber] = cardCode.split(":");
  const { cardsByNumber } = getSet(setCode.toUpperCase());
  return cardsByNumber[cardNumber] || cardsByNumber[parseInt(cardNumber)] || cardsByNumber[cardNumber.toLowerCase()];
};

module.exports = fetch;

//Allow this script to be called directly from commandline.
if (!module.parent) {
  fetch();
}