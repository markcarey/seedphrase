var functions = require('firebase-functions');
var firebase = require('firebase-admin');
var storage = firebase.storage();
const bucket = storage.bucket("seedphrase");
var db = firebase.firestore();

const express = require("express");
const api = express();
const cors = require("cors");
const cookieParser = require('cookie-parser')();

const fetch = require('node-fetch');
const _ = require('lodash');
const moment = require('moment');

var imageDataURI = require("image-data-uri");
var textToImage = require("text-to-image");
var text2png = require('text2png');
var sigUtil = require("eth-sig-util");

const { ethers } = require("ethers");
const { nextTick } = require('async');

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const seedJSON = require(__base + 'seed/SeedPhraseNFT.json');

const message = "Sign in to Seedphrase Pictures";

function getConfig(network) {
  var g = 0; // first tokenId in current season (for current phrase)
  if (network == 'testnet') {
    g = 0;
    const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_ARBIGOERLI});
    const seed = new ethers.Contract(
      process.env.SEED_PICTURES_ADDR_TESTNET,
      seedJSON.abi,
      provider
    );
    return {
      "seed": seed,
      "nftAddress": process.env.SEED_PICTURES_ADDR_TESTNET,
      "phrase": process.env.SEED_PHRASE_TESTNET,  // stored as a "secret" (https://cloud.google.com/functions/docs/configuring/secrets)
      "style": "kodachrome photography",
      "size": "512x512",
      "season": 1,
      "folder": "testnet/",
      "revealDelay": 60*60,
      "thresholds": {
        "min": g + 1,
        "max": g + 6,
        "tier1": g + 10,
        "tier2": g + 12,
        "tier3": g + 14,
        "tier4": g + 16,
        "tier5": g + 20,
        "position": g + 22,
        "letterCount": g + 25,
        "startsWith": g + 50,
        "endsWith": g + 100
      }
    };
  } else {
    g = 0; // first tokenId in current season (for current phrase)
    const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_ARBITRUM});
    const seed = new ethers.Contract(
      process.env.SEED_PICTURES_ADDR,
      seedJSON.abi,
      provider
    );
    return {
      "nftAddress": process.env.SEED_PICTURES_ADDR,
      "phrase": process.env.SEED_PHRASE,  // stored as a "secret" (https://cloud.google.com/functions/docs/configuring/secrets)
      "style": "digital art",
      "size": "1024x1024",
      "season": 1,
      "folder": "",
      "revealDelay": 60*60,
      "thresholds": {
        "min": g + 1,
        "max": g + 1,
        "tier1": g + 0,
        "tier2": g + 0,
        "tier3": g + 0,
        "tier4": g + 0,
        "tier5": g + 0,
        "position": g + 0,
        "letterCount": g + 250,
        "startsWith": g + 500,
        "endsWith": g + 1000
      }
    };
  }
}

function getPromptAndMeta(id, config) {
  var prompt = '';
  const season = config.season;
  const phrase = config.phrase;
  const style = config.style;
  const thresholds = config.thresholds;
  var min = thresholds.min;
  var max = thresholds.max;
  var revealDelay = config.revealDelay; // seconds

  //defaults:
  var revealPosition = false;
  var letterCount = false;
  var startsWith = false;
  var endsWith = false;

  // The following thresholds may be enabled for future seed phrases, to increase difficulty
  // setting if (id > 0) effectively disables these and generates an image based on a single
  // word from the phrase and reveals its position in the NFT metadata
  if (id > thresholds.tier1) {
    max = 5;
  }
  if (id > thresholds.tier2) {
    max = 4;
  }
  if (id > thresholds.tier3) {
    max = 3;
  }
  if (id > thresholds.tier4) {
    max = 2;
  }
  if (id > thresholds.tier5) {
    min = 1;
    max = 1;
  }
  if (id > thresholds.position) {
    revealPosition = true;
  }
  if (id > thresholds.letterCount) {
    letterCount = true;
  }
  if (id > thresholds.startsWith) {
    startsWith = true;
  }
  if (id > thresholds.endsWith) {
    endsWith = true;
  }
  // create an array from the seed phrase:
  const phraseAsArray = _.split(phrase, ' ');
  // randomly shuffle the array:
  const phraseShuffled = _.shuffle(phraseAsArray);
  // randomly choose a number of words to use for the image, between `min` and `max`:
  const words = _.random(min, max);
  // create new, shorter array with the words for the image:
  const shortArray = _.take(phraseShuffled, words);
  // convert shortArray to a space-separated string
  const newPhrase = _.join(shortArray, ' ');
  // append the art `style` to the prompt (future seed phrases may use different styles)
  prompt = newPhrase + ", " + style;
  var folder = config.folder;
  const meta = {
    "name": `Seed Phrase HINT #${id}`,
    "description": "Guess the seed phrase! AI-generated images provide HINTs about the words in the seed phrase. Guess the seed phrase and the prize pool is yours.",
    "external_url": "https://seedphrase.pictures", 
    "image": `https://api.seedphrase.pictures/${folder}images/${id}.png`,
    "seller_fee_basis_points": 1000,
    "fee_recipient": process.env.SIDEDOOR_COLD,
    "reveal_after": moment().utc().unix() + revealDelay,
    "token_id": id,
    "attributes": [
        {
            "trait_type": "Season", 
            "value": season.toString(),
        }, 
        {
            "trait_type": "ID", 
            "value": id.toString(),
        },
        {
            "trait_type": "Number of Words", 
            "value": words.toString(),
        },
        {
            "trait_type": "Style", 
            "value": style
        }
    ] 
  };
  if (words == 1) {
    if (revealPosition) {
      // get position of the word in the seed phrase
      const pos = _.indexOf(phraseAsArray, shortArray[0]) + 1;
      meta.attributes.push({
        "trait_type": "Position",
        "value": pos.toString()
      });
    }
    if (letterCount) {
      // count the number of letters in the word
      const count = newPhrase.length;
      meta.attributes.push({
        "trait_type": "Letter Count",
        "value": count.toString()
      });
    }
    if (startsWith) {
      // get the first letter of the word
      const start = Array.from(newPhrase)[0];
      meta.attributes.push({
        "trait_type": "Starts With",
        "value": start
      });
    }
    if (endsWith) {
      // get the last letter of the word
      const count = newPhrase.length;
      const end = Array.from(newPhrase)[count - 1];
      meta.attributes.push({
        "trait_type": "Ends With",
        "value": end
      });
    }
  } // if words == 1
  return {"prompt": prompt, "meta": meta};
}

async function generate(id, config) {
  return new Promise(async (resolve, reject) => {
    const seedAddress = config.nftAddress;
    const nft = getPromptAndMeta(id, config);
    //console.log("generate addr", config.nftAddress);
    const metaRef = db.collection('nft').doc(seedAddress).collection('meta').doc(id.toString());
    var doc = await metaRef.get();
    if (doc.exists) {
      // metadata already exists for this tokenId: assume image has also already been created and saved
      console.log(`generate: meta for nft ${seedAddress} / ${id} already exists`);
      resolve(true);
    } else {
      // 1. create image:
      var prompt = nft.prompt;
      const aiResponse = await openai.createImage({
        "prompt": prompt,
        "n": 1,
        "size": config.size
      });
      const result = await fetch(aiResponse.data.data[0].url);

      // 2. Save image to storage bucket
      const readStream = result.body;
      const writeStream = bucket.file(`${seedAddress}/${id}.png`).createWriteStream();
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve(true));
      readStream.pipe(writeStream);

      // 3. Save metadata to Firestore
      await metaRef.set(nft.meta);
    }
  });
}

function getSig(req, res, next) {
  console.log(req.cookies["__session"]);
  var sig = null;
  if ("cookies" in req) {
    if ("__session" in req.cookies) {
      sig = req.cookies["__session"];
    }
  }
  req.sig = sig;
  next();
}

api.use(cors({ origin: true })); // enable origin cors
api.use(cookieParser);
api.use(getSig);

api.get(['/images/:id.png', '/:network/images/:id.png'], async function (req, res) {
  //console.log("network", req.params.network);
  console.log("start /images/ with path", req.path);
  const id = parseInt(req.params.id);
  const network = req.params.network;
  const config = getConfig(network);
  //console.log("image id", id);
  const seedAddress = config.nftAddress;
  const phrase = config.phrase;
  //console.log("image seed addr", seedAddress);
  var cache = 'public, max-age=3600, s-maxage=86400';

  // Step 1: Validate
  var seed = config.seed; // nft contract
  var minted = false;
  const exists = await seed.exists(id);
  if ( exists ) {
    minted = true;
  }

  if ( !minted ) {
    return res.redirect('https://api.seedphrase.pictures/img/not-minted.png');
  }

  // Step 2: Fetch Image
  //console.log("path", req.path);
  var file;

  try {
    file = await bucket.file(`${seedAddress}/${id}.png`).download();
    //console.log(file);
  }
  catch (e) {
    console.log(`image: did not find image for ${req.path} for nft ${seedAddress} so generate image`);
    await generate(id, config);
    file = await bucket.file(`${seedAddress}/${id}.png`).download();
    //return res.json({"result": "catch: no file yet"});
  }

  if (!file) {
    console.log(`image: no file after try/catch for ${req.path} for nft ${seedAddress}`);
    return res.json({"result": "no file yet"});
  }

  var allowed = true;
  const metaRef = db.collection('nft').doc(seedAddress).collection('meta').doc(id.toString());
  var doc = await metaRef.get();
  const revealAfter = doc.data().reveal_after;
  console.log( revealAfter, moment().utc().unix() );
  if (revealAfter > moment().utc().unix()) {
    allowed = false;
    //console.log("sig", req.sig);
    if (req.sig) {
      try {
        const signedAddress = ethers.utils.verifyMessage(message, req.sig);
        const ownerAddress = await seed.ownerOf(id);
        console.log(signedAddress, ownerAddress);
        if (signedAddress == ownerAddress) {
          allowed = true;
        }
      }
      catch(e) {
        console.log(e);
      }
    } // if req.sig
  } // if revealAfer

  if (!allowed) {
    return res.redirect('https://api.seedphrase.pictures/img/not-revealed.png');
  }

  const img = file[0];
  res.set('Cache-Control', cache);
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': img.length
  });
  return res.end(img);
}); // image

api.get(['/meta/:id', '/:network/meta/:id'], async function (req, res) {
  console.log("start /meta/ with path", req.path);
  const network = req.params.network;
  const config = getConfig(network);
  const seedAddress = config.nftAddress;
  const phrase = config.phrase;
  const id = parseInt(req.params.id);
  //console.log("id", id);
  //console.log("addr", seedAddress);
  var cache = 'public, max-age=3600, s-maxage=86400';

  // Step 1: Validate
  var seed = config.seed; // nft contract
  var minted = false;
  const exists = await seed.exists(id);
  if ( exists ) {
    minted = true;
  }

  if ( !minted ) {
    return res.json({ "error": "not minted" });
  }

  // Step 2: Get Meta JSON
  console.log(req.path);
  
  const metaRef = db.collection('nft').doc(seedAddress).collection('meta').doc(id.toString());
  var doc = await metaRef.get();

  if ( doc.exists ) {
    res.set('Cache-Control', cache);
    return res.json(doc.data());
  } else {
    await generate(id, config);
    doc = await metaRef.get();
    if ( doc.exists ) {
      res.set('Cache-Control', cache);
      return res.json(doc.data());
    } else {
      return res.json({"error": "metadata not found"});
    }
  }
}); // meta

module.exports.api = api;