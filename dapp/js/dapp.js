const firebaseConfig = {
    apiKey: "AIzaSyCok6-ZTyyTfPISEHqeIqRHuEaew6hiDW0",
    authDomain: "slash-translate.firebaseapp.com",
    databaseURL: "https://slash-translate.firebaseio.com",
    projectId: "slash-translate",
    storageBucket: "slash-translate.appspot.com",
    messagingSenderId: "371132153129",
    appId: "1:371132153129:web:b4ba367b78bd5c14ac8b38"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = firebase.firestore();

const zeroAddress = "0x0000000000000000000000000000000000000000";
const WINNER_ROLE = "0x50d7f4cd6d71ed14bb09203429e7cf4d8d07824ec09d3fa90c05c12b548b07f7";

const chains = {};
chains["421613"] = {
    "chainId":  ethers.utils.hexValue(421613),
    "chainName": "Arbitrum Goerli Testnet",
    "nativeCurrency": {
        "name": "ETH",
        "symbol": "ETH",
        "decimals": 18
    },
    "rpcUrls": ["https://goerli-rollup.arbitrum.io/rpc"],
    "blockExplorerUrls": ["https://goerli.arbiscan.io/"],
}
chains["42161"] = {
    "chainId":  ethers.utils.hexValue(42161),
    "chainName": "Arbitrum One",
    "nativeCurrency": {
        "name": "ETH",
        "symbol": "ETH",
        "decimals": 18
    },
    "rpcUrls": ["https://arb1.arbitrum.io/rpc/"],
    "blockExplorerUrls": ["https://arbiscan.io/"],
}

var addr = {};
addr.arbitrumGoerli = {
    "nftAddress": "0xC825dd6c5742532b2a30591eea09017A9a6c9d8f",
    "evmChainId": 421613,
    "testnet": true,
    "name": "Arbitrum Goerli",
    "rpc": "arb-goerli.g.alchemy.com/v2/jb4AhFhyR0X_ChVX5J1f0oWQ6GvJqLK0",
    "slug": "arbitrum-goerli",
    "folder": "testnet/",
    "native": "ETH"
};
addr.arbitrumOne = {
    "nftAddress": "0x0BDde82Bfc59eff2d599b003d81083d46B39D60E",
    "evmChainId": 42161,
    "testnet": false,
    "name": "Arbitrum One",
    "rpc": "arb-mainnet.g.alchemy.com/v2/jb4AhFhyR0X_ChVX5J1f0oWQ6GvJqLK0",
    "slug": "arbitrum",
    "folder": "",
    "native": "ETH"
};

//var chain = "arbitrumGoerli";
var chain = "arbitrumOne";
var web3, hint;
var accounts = [];
var provider, ethersSigner;
var hints = [];
var resetHints;
var batchCount = 0;

const mintPrice = 0.005;
const baseUrl = 'https://api.seedphrase.pictures/';
const message = "Sign in to Seedphrase Pictures";

var tokenId;

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
};

var allChains = ["arbitrumGoerli", "arbitrumOne"];
//var allChains = ["arbitrumGoerli"];
for (let i = 0; i < allChains.length; i++) {
    if ( addr[chain].nftAddress ) {
        var thisChain = allChains[i];
        const chainProvider = new ethers.providers.JsonRpcProvider({"url": "https://"+addr[thisChain].rpc});
        addr[thisChain].hint = new ethers.Contract(addr[thisChain].nftAddress, nftABI, chainProvider);
    }
}

function getChainKey(chainId) {
    if (chainId.toString() == "42161" ) {
        return 'arbitrumOne';
    }
    if (chainId.toString() == "421613" ) {
        return 'arbitrumGoerli';
    }
}

function setupChain() {
    var rpcURL = addr[chain].rpc;
    const prov = {"url": "https://"+rpcURL};
    provider = new ethers.providers.JsonRpcProvider(prov);
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    }
    var wssProvider = new ethers.providers.WebSocketProvider(
        "wss://" + rpcURL
    );
    hint = new ethers.Contract(
        addr[chain].nftAddress,
        nftABI,
        wssProvider
    );
    web3 = AlchemyWeb3.createAlchemyWeb3("wss://"+rpcURL);
    preload('https://seedphrase.pictures/img/minting.gif');
    preload('https://seedphrase.pictures/img/not-revealed.png');
}
setupChain();

provider.on("network", async (newNetwork, oldNetwork) => {
    if (oldNetwork) {
        //console.log(newNetwork, oldNetwork);
        const oldChain = chain;
        setChain(newNetwork.chainId);
        if (chain == oldChain) {
            // they switched to unsupported chain, so switch back
            await switchChain(addr[chain].evmChainId);
        } else {
            //console.log("switching to supported chain " + chain);
            setupChain();
            updateImages(getChainKey(oldNetwork.chainId),chain);
            if ( addr[chain].testnet ) {
                $("#network").show();
            } else {
                $("#network").hide();
            }
            $("#minted-hints").html('');
            await updateStats();
            loadHints();
        }
    }
});

function loadHints () {
    if (resetHints) {
        resetHints();
    }
    resetHints = db.collection("nft").doc(addr[chain].nftAddress).collection('meta').orderBy("token_id", "asc")
        .onSnapshot((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                var meta = doc.data();
                meta.tokenId = doc.id;
                //if ( $("#tokenid").text() == doc.id.toString() ) {
                //    $("#mint-image").attr("src", meta.image);
                //}
                //console.log(meta);
                if ( $( "#hint-" + doc.id ).length <= 0 ) {
                    $("#minted-hints").prepend( getHintHTML(meta) );
                } else {
                    $( "#hint-" + doc.id ).replaceWith( getHintHTML(meta) );
                }
            });
    });
}

function setChain(chainId) {
    if (chainId == 80001) {
        //chain = "mumbai";
    }
    if (chainId == 420) {
        //chain = "optigoerli";
    }
    if (chainId == 5) {
        //chain = "goerli";
    }
    if (chainId == 421613) {
        chain = "arbitrumGoerli";
    }
    if (chainId == 42161) {
        chain = "arbitrumOne";
    }
    if (chainId == 1287) {
        //chain = "moonbeam-alpha";
    }
}

function abbrAddress(address){
    if (!address) {
        address = accounts[0];
    }
    return address.slice(0,4) + "..." + address.slice(address.length - 4);
}

async function connect(){
    if (window.ethereum) {
        //console.log("window.ethereum true");
        await provider.send("eth_requestAccounts", []);
        ethersSigner = provider.getSigner();
        accounts[0] = await ethersSigner.getAddress();
        console.log(accounts);

        const userChainHex = await ethereum.request({ method: 'eth_chainId' });
        const userChainInt = parseInt(userChainHex, 16);
        console.log("userChainInt", userChainInt);
        if (userChainInt in chains) {
            // supported chain
            if (userChainInt != addr[chain].evmChainId) {
                // connected to supported chain but not the current chain
                setChain(userChainInt);
                setupChain();
                await updateStats();
                loadHints();
            }
        } else {
            await switchChain(addr[chain].evmChainId);
        }
        if ( addr[chain].testnet ) {
            $("#network").show();
        } else {
            $("#network").hide();
        }

        var sig = Cookies.get('__session');
        if (!sig) {
            console.log('no sig');
            sig = await ethersSigner.signMessage(message);
            console.log(sig);
            if (sig) {
                //Cookies.set('__session', sig);
                Cookies.set('__session', sig, { path: '/', domain: '.seedphrase.pictures' });
            }
        }
        $(".address").text(abbrAddress());
        $("#offcanvas").find("button").click();
        const isWinner = await hint.hasRole(WINNER_ROLE, accounts[0]);
        if (isWinner) {
            $("#winner").text("You have guessed the seed phrase correctly!");
            $("#claim-button").removeClass("disabled");
            $("#nav-claim").click();
        }
    } else {
        // The user doesn't have Metamask installed.
        console.log("window.ethereum false");
    } 
}

async function mint(quantity) {
    console.log(quantity);
    console.log(chain);
    console.log(addr[chain].nftAddress);
    console.log(addr[chain].rpc);
    if (!ethersSigner) {
        await connect();
    }
    var tx;
    const valueETH = quantity * mintPrice;
    const valueWEI = ethers.utils.parseUnits(valueETH.toString(), "ether");
    console.log(valueETH, valueWEI);
    if ( quantity == 1 ) {
        tx =  await hint.connect(ethersSigner).safeMint(accounts[0], { "value": valueWEI});
    } else {
        tx =  await hint.connect(ethersSigner).batchMint(accounts[0], quantity, { "value": valueWEI});
    }
    $("#mint-image").attr("src", 'https://seedphrase.pictures/img/minting.gif');
    let mintFilter = hint.filters.Transfer(zeroAddress, accounts[0]);
    hint.off(mintFilter);
    batchCount = 0;
    hint.on(mintFilter, async (from, to, id, event) => { 
        tokenId = id;
        console.log('tokenId:' + tokenId);
        const folder = addr[chain].folder;
        const imageURL = `${baseUrl}${folder}images/${tokenId}.png`;
        preload(imageURL);
        $("#mint-image").attr("src", imageURL);
        $("#tokenid").text(tokenId);
        $("#mint-title").text("");
        $("#mint-title-label").text("Minted!");
        $("#birth-chain, #color, #wearing").parents(".mint-field").hide();
        $("#mint-button").text("Minted!");
        batchCount++;
        if (batchCount == quantity) {
            await updateStats();
        }
        await sleep(1000);
        $("#mint-button").attr("href", getMarketplaceURL(chain, tokenId)).text("View on Opensea");
        await sleep(1000);
        $("#reset-button").show();
        if ( quantity > 1) {
            $("#viewall-button").show();
        }
    });
    await tx.wait();
}

async function updateStats() {
    var total = await hint.totalSupply();
    var prize = await provider.getBalance(hint.address);
    //console.log("prize", prize);
    $("#total-minted").text(total);
    $("#prize").text(ethers.utils.formatEther(prize));
}

async function claim() {
    const isWinner = await hint.hasRole(WINNER_ROLE, accounts[0]);
    if (isWinner) {
        const tx =  await hint.connect(ethersSigner).withdraw();
        let winFilter = hint.filters.SeedPhraseGuessed();
        hint.on(winFilter, async (winner, prize, event) => {
            $("#claim-button").text("You won " + ethers.utils.formatEther(prize) + "ETH");
        });
        await tx.wait();
    } else {
        $("#winner").text("The connected address is not a winner :(");
        $("#claim-button").addClass("disabled");
    }    
}

async function switchChain(chainId) {
    try {
        await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: web3.utils.toHex(chainId) }]
        });
    } catch (switchError) {
        console.log(switchError);
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
            try {
                var switchParams = chains[chainId];
                await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        switchParams
                    ],
                });
                switchChain(chainId);
            } catch (addError) {
                // handle "add" error
            }
        }
        // handle other "switch" errors
    }
    setChain(chainId);
    setupChain();
}


function reset() {
    $("#mint-image").attr("src", "https://seedphrase.pictures/images/mint.png");
    $("#tokenid").text("?");
    $("#mint-title").text("Public Mint is ");
    $("#mint-title-label").text("Live");
    $("#mint-button").attr("href", "#").show().text("Mint Now");
    $("#viewall-button").hide();
    $("#quantity").val(1);
    tokenId = null;
}

function getMarketplaceURL(currentChain, tokenId) {
    const slug = addr[currentChain].slug;
    const nftAddress = addr[currentChain].nftAddress;
    var subdomain = "";
    if ( addr[currentChain].testnet ) {
        subdomain = "testnets.";
    }
    var url = `https://${subdomain}opensea.io/assets/${slug}/${nftAddress}/${tokenId}`;
    return url;
}

function preload(url) {
    var image = new Image();
	image.src = url;
}

function updateImages(oldChain, newChain) {
    const oldFolder = addr[oldChain].folder;
    const newFolder = addr[newChain].folder;
    $("img.hint").each(function() {
        //console.log('start on hint image');
        const oldSrc = $(this).attr("src");
        const baseSrc = oldSrc.replace(oldFolder, '');
        const newSrc =  newFolder + baseSrc;
        if (newSrc != oldSrc) {
            //console.log('need to replace src on hint img', oldSrc, newSrc);
            $(this).attr("src", newSrc);
        }
    });
}

function getHintHTML(meta) {
    var html = ''
    var position = "n/a";
    for (let i = 0; i < meta.attributes.length; i++) {
        if (meta.attributes[i]["trait_type"] == "Position") {
            position = meta.attributes[i].value;
        }
    }
    const opensea = getMarketplaceURL(chain, meta.tokenId);
    html = `
    <div id="hint-${meta.tokenId}" class="col-sm-6 col-md-4">
        <div class="position-relative bg-dark-2 shadow rounded-4"> <img class="img-fluid d-flex rounded-4 rounded-bottom-0" src="${meta.image}" alt="">
        <div class="p-4">
            <div class="d-flex align-items-center"> <a href="${opensea}" class="overflow-hidden stretched-link me-2">
            <h4 class="text-3 link-light text-truncate mb-0">HINT #${meta.tokenId}</h4>
            </a>
            <div class="text-light text-2 d-inline-block text-nowrap ms-auto">Position: ${position}</div>
            </div>
        </div>
        </div>
    </div>
    `;
    return html;
}

$( document ).ready(function() {

    loadHints();

    $(".connect").click(function(){
        connect();
        return false;
    });

    $("#mint-button").click(function(){
        if (tokenId) {
            return true;
        }
        $(this).text("Minting...");
        const quantity = $("#quantity").val();
        mint(quantity);
        return false;
    });

    $("#claim-button").click(function(){
        claim();
        return false;
    });

    $("#reset-button").click(function(){
        reset();
        $(this).hide();
        return false;
    });

    $(".switch").click(async function(){
        var chainId = $(this).data("chain");
        await switchChain(chainId);
        return false;
    });

});