const Web3 = require('web3');
const bigInt = require("big-integer");
const Mysql = require("./mysqldb/database");
var dateFormat = require("date-format");
var events = require("events");
require("dotenv").config();
const INFURA_KEY = process.env.INFURA_KEY;
const NETWORK = process.env.NETWORK;
let web3 = new Web3(new Web3.providers.HttpProvider(`https://${NETWORK}.infura.io/v3/${INFURA_KEY}`));
var ETH_API = require('etherscan-api').init(process.env.API_KEY_EXCHANGE, NETWORK);
const XHR = require("xhr2-cookies").XMLHttpRequest;

const CA721 = process.env.CA721_IN.toLowerCase();
const TRANSFER_EVENT = process.env.TRANSFER_EVENT.toLowerCase();
const CA1155 = process.env.CA1155_IN.toLowerCase();
const TRANSFER_SINGLE_EVENT = process.env.TRANSFER_SINGLE_EVENT.toLowerCase();
const FEE_ADDRESS = process.env.FEE_ADDRESS.toLowerCase();
const WETH_CA = process.env.CA_WETH.toLowerCase();
const EXCHANGE_CA = process.env.CA_EXCHANGE.toLowerCase();

let Event_box = [];
// 같은 트랜잭션이 db에 저장되는 것을 막기 위한 배열
let Tx_box = [];
var em = new events.EventEmitter();

let web3ws = new Web3(new Web3.providers.WebsocketProvider(`wss://${NETWORK}.infura.io/ws/v3/${INFURA_KEY}`, {
    // @ts-ignore
    clientConfig: {
        maxReceivedFrameSize: 100000000*10,
        maxReceivedMessageSize: 100000000*10, // 요청이 많이 발생하면 응답이 오지 않으므로 최대 ReceivedMessageSize를 10배 증가시킨다.
        keepalive: true,
        keepaliveInterval: 60000	// milliseconds
    },
    reconnect: {
        auto: true,
        delay: 5000, //ms
        maxAttempts: 5,
        onTimeout: false
    }
}));

const EXCHANGE = 2;
async function Subscribe_Contract(){
    let BN = await Mysql.Get_BlockNum(EXCHANGE);
    let num = 1;
    if (Object.values(BN[0])[0] === "null"){
        num = 1;
    } else{
        num = Object.values(BN[0])[0] + 1;
    }
    try{
        let options = {
            fromBlock: 	num,
            address: [EXCHANGE_CA],
            topics: [],
            reconnect: {
                auto: true,
                delay: 5000,
                maxAttempts: 5,
                onTimeout: false
            },
            clientConfig: {
                keepalive: true,
                keepaliveInterval: 60000 //ms
            },
            // Enable auto reconnection
            reconnect: {
                auto: true,
                delay: 5000, //ms
                maxAttempts: 5,
                onTimeout: false
            }
        };
        
        let subscription = web3ws.eth.subscribe('logs', options, (err, event) => {
            if (!err){
                // 데이터를 보내는 역할만 한다.
                em.emit("data send", event);
            }else{
                console.log(err);
                // error detail 확인가능
                XHR.prototype._onHttpRequestError = function (request, err) {
                    if (this._request !== request) {
                        return;
                    }
                    // A new line
                    console.log(err, 'request');
                    this._setError();
                    request.abort();
                    this._setReadyState(XHR.DONE);
                    this._dispatchProgress('error');
                    this._dispatchProgress('loadend');
                };
            }
        })
        
        setTimeout(() => subscription.on('data', event => {console.log("data")}), 3000)
        subscription.on('changed', changed => console.log("changed: "+changed))
        subscription.on('error', err => console.log("error: "+err))
        subscription.on('connected', nr => console.log(nr))
        
    }catch(e){
        if (e === "No transactions found"){
            console.log("There is no blockNumber higher than parameter.");
        }
    }
}

setTimeout( () => Subscribe_Contract(), 10);

em.on("data send", function(data){
    // subscription 함수에서 넘어온 데이터를 배열에 저장
    console.log("------------------------------Event_box---------------------------------------");
    Event_box.push(data);
    console.log(Event_box.length);
});

let exchange_obj = {};

function pick_up_basic_data(receipt){
    let tx_obj = {};
    receipt.map(topic => {
        if ((topic.topics[0].toLowerCase() === TRANSFER_EVENT) && (topic.topics.length === 4)){
            let TokenID = String(topic.topics[3]).substr(2, 64);
            TokenID = bigInt(TokenID, 16);
            let Seller = '0x' + String(topic.topics[1]).substr(26, 40);
            let Buyer = '0x' + String(topic.topics[2]).substr(26, 40);
            let Value = '1';
            tx_obj.TokenID = TokenID;
            tx_obj.Seller = Seller;
            tx_obj.Buyer = Buyer;
            tx_obj.Value = Value;
            tx_obj.token_type = "ERC721";
        } else if((topic.topics[0].toLowerCase() === TRANSFER_SINGLE_EVENT) && (topic.topics.length === 4)){
            let TokenID = String(topic.data).substr(2, 64);
            TokenID = bigInt(TokenID, 16);
            let Seller = "0x" + topic.topics[2].substr(26, 40);
            let Buyer = "0x" + topic.topics[3].substr(26, 40);
            let Value = String(topic.data).substr(66, 64);
            Value = bigInt(Value, 16);
            tx_obj.TokenID = TokenID;
            tx_obj.Seller = Seller;
            tx_obj.Buyer = Buyer;
            tx_obj.Value = Value;
            tx_obj.token_type = "ERC1155";
        }
    })
    return tx_obj;
}

function pick_up_ETH_payment_data(internal_box){
    let fee_count = 0;
    let seller_count = 0;
    let ETH_box = [];
    let fee_box = [];
    let counter = 0;
    internal_box.map(obj => {
        counter = counter + 1;
        if (String(obj.to).toLowerCase() === FEE_ADDRESS){
            fee_count = fee_count + 1;
            fee_box.push(Number(web3.utils.fromWei(String(obj.value), "ether")));
        }
        if (String(obj.to).toLocaleLowerCase() === exchange_obj.Seller.toLowerCase()){
            seller_count = seller_count + 1;
            ETH_box.push(Number(web3.utils.fromWei(String(obj.value), "ether")));
        }
        if (internal_box.length === 3){
            // 수수료 계정이 2개인 경우
            if ((fee_count === 2) && (counter === 3)){
                exchange_obj.fee = Math.min(...fee_box);
                exchange_obj.Actual_Amount = Math.max(...fee_box);
                fee_box.splice(fee_box.indexOf(exchange_obj.Actual_Amount), 1);
                fee_box.splice(fee_box.indexOf(exchange_obj.fee), 1);
                
                internal_box.map(elem => {
                    if (String(elem.to).toLowerCase() != FEE_ADDRESS){
                        exchange_obj.Royalty_recipient = elem.to;

                        // exchange_obj.Royalty 값이 undefined 일 경우 처리
                        if(false == isNaN(exchange_obj.Royalty))
                            exchange_obj.Royalty = web3.utils.fromWei(String(exchange_obj.Royalty), "ether");
                        else
                            exchange_obj.Royalty = 0;
                    }
                })
            } 
            // 수수료 계정이 3개인 경우 (판매자, 수수료계정, 로얄티 수령계정이 모두 같은 경우)
            else if(fee_count === 3){
                exchange_obj.fee = Math.min(...fee_box);
                exchange_obj.Actual_Amount = Math.max(...fee_box);
                fee_box.splice(fee_box.indexOf(exchange_obj.Actual_Amount), 1);
                fee_box.splice(fee_box.indexOf(exchange_obj.fee), 1);
                exchange_obj.Royalty = fee_box[0];
                exchange_obj.Royalty_recipient = FEE_ADDRESS;
            }
            // 수수료 계정이 1번 호출된 경우
            else {
                // 판매자 계정과 로얄티 수령계정이 같은 경우
                if ((seller_count === 2) && (fee_count === 1)){
                    exchange_obj.Actual_Amount = Math.max(...ETH_box);
                    exchange_obj.fee = fee_box[0];
                    exchange_obj.Royalty = Math.min(...ETH_box);
                    exchange_obj.Royalty_recipient = exchange_obj.Seller.toLowerCase();
                }
                // 판매자 계정과 로얄티 수령계정과 수수료 계정이 모두 다른 경우
                else if ((seller_count === 1) && (fee_count === 1) && (counter === 3)){
                    exchange_obj.Actual_Amount = ETH_box[0];
                    exchange_obj.fee = fee_box[0];
                    internal_box.map(comp => {
                        if ((String(comp.to).toLowerCase() != FEE_ADDRESS) && (String(comp.to).toLowerCase() != exchange_obj.Seller.toLowerCase())) {
                            exchange_obj.Royalty = web3.utils.fromWei(String(comp.value), "ether");
                            exchange_obj.Royalty_recipient = comp.to;
                        }
                    })
                }
            }
        } else if(internal_box.length === 2){
            // Royalty가 없고 수수료 계정이 판매자인 경우
            if ((fee_count === 2) && (counter === 2)){
                exchange_obj.fee = Math.min(...fee_box);
                exchange_obj.Actual_Amount = Math.max(...fee_box);
            } 
            // Royalty가 없고 수수료만 낸 경우
            else if ((fee_count === 1) && (counter === 2)){
                exchange_obj.fee = fee_box[0];
                exchange_obj.Actual_Amount = ETH_box[0];
            }
            // Royalty만 있고 수수료가 없는 경우
            else if ((seller_count === 1) && (counter >= 1) && (fee_count === 0)){
                exchange_obj.Actual_Amount = ETH_box[0];
                if (String(obj.to) != exchange_obj.Seller.toLowerCase()){
                    exchange_obj.Royalty_recipient = obj.to;
                    exchange_obj.Royalty = web3.utils.fromWei(String(obj.value), "ether");
                }
                exchange_obj.fee = 0;
            }
        } else if (internal_box.length === 1){
            exchange_obj.Actual_Amount = ETH_box[0];
            exchange_obj.fee = 0;
        }
    });
    if (exchange_obj.Royalty === undefined){
        exchange_obj.Royalty = 0;
    }
    if (exchange_obj.fee === undefined){
        exchange_obj.fee = 0;
    }
    return exchange_obj;
}

function pick_up_WETH_payment_data(receipt_box){
    let check_num = 0;
    let fee_check_num = 0;
    receipt_box.map(set => {
        if ((set.topics[0] === TRANSFER_EVENT) && (set.topics.length === 3) ){
            let account = "0x" + String(set.topics[2]).substr(26, 40);
            if ((receipt_box.length === 3)){
                if ((account === exchange_obj.Seller) && check_num === 0){
                    exchange_obj.Actual_Amount = String(set.data).substr(2, 64);
                    exchange_obj.Actual_Amount = bigInt(exchange_obj.Actual_Amount, 16);
                    exchange_obj.Actual_Amount = web3.utils.fromWei(String(exchange_obj.Actual_Amount), "ether");
                    check_num = check_num + 1;
                } 
                // 판매자 계정과 로얄티수령 계정이 같은 경우
                else if((account === exchange_obj.Seller) && (check_num === 1)){
                    let amount = String(set.data).substr(2, 64);
                    amount = bigInt(amount, 16);
                    amount = Number(web3.utils.fromWei(String(amount), "ether"));
                    if (exchange_obj.Actual_Amount > amount){
                        exchange_obj.Royalty = amount;
                        exchange_obj.Royalty_recipient = account;
                    } else {
                        exchange_obj.Royalty = exchange_obj.Actual_Amount;
                        exchange_obj.Actual_Amount = amount;
                        exchange_obj.Royalty_recipient = account;
                    }
                }
                else if ((account.toLowerCase() === FEE_ADDRESS) && (fee_check_num === 0)){
                    exchange_obj.fee = String(set.data).substr(2, 64);
                    exchange_obj.fee = bigInt(exchange_obj.fee, 16);
                    exchange_obj.fee = web3.utils.fromWei(String(exchange_obj.fee), "ether");
                    fee_check_num = fee_check_num + 1;
                }
                // 수수료 계정과 판매자 계정이 같은 경우
                else if ((account.toLowerCase() === FEE_ADDRESS) && fee_check_num === 1){
                    let amount = String(set.data).substr(2, 64);
                    amount = bigInt(amount, 16);
                    amount = amount / 10 ** 18;
                    if (exchange_obj.fee > amount){
                        exchange_obj.Actual_Amount = exchange_obj.fee;
                        exchange_obj.fee = amount;
                    } else {
                        exchange_obj.Actual_Amount = amount;
                    }
                    fee_check_num = fee_check_num + 1;
                }
                // 수수료 계정, 판매자 계정, 로얄티 수령 계정이 모두 같은 경우
                else if ((account.toLowerCase() === FEE_ADDRESS) && (fee_check_num === 2)){
                    let amount = String(set.data).substr(2, 64);
                    amount = bigInt(amount, 16);
                    amount = web3.utils.fromWei(String(amount), "ether");
                    exchange_obj.Royalty = amount;
                }
                else if ((account.toLowerCase() != FEE_ADDRESS) && (account.toLowerCase() != exchange_obj.Seller.toLowerCase())){
                    exchange_obj.Royalty = String(set.data).substr(2, 64);
                    exchange_obj.Royalty = bigInt(exchange_obj.Royalty, 16);
                    exchange_obj.Royalty_recipient = account;
                    exchange_obj.Royalty = web3.utils.fromWei(String(exchange_obj.Royalty), "ether");
                }
            } else if (receipt_box.length === 2){
                if (account === exchange_obj.Seller){
                    exchange_obj.Actual_Amount = String(set.data).substr(2, 64);
                    exchange_obj.Actual_Amount = bigInt(exchange_obj.Actual_Amount, 16);
                    exchange_obj.Actual_Amount = web3.utils.fromWei(String(exchange_obj.Actual_Amount), "ether");
                } else if ((account.toLowerCase() === FEE_ADDRESS) && (check_num === 0)){
                    exchange_obj.fee = String(set.data).substr(2, 64);
                    exchange_obj.fee = bigInt(exchange_obj.fee, 16);
                    exchange_obj.fee = web3.utils.fromWei(String(exchange_obj.fee), "ether");
                    check_num = check_num + 1;
                }
                // 수수료 계정과 판매자 계정이 같은 경우
                else if ((account.toLowerCase() === FEE_ADDRESS) && check_num === 1){
                    let amount = String(set.data).substr(2, 64);
                    amount = bigInt(amount, 16);
                    amount = amount / 10 ** 18;
                    if (exchange_obj.fee > amount){
                        exchange_obj.Actual_Amount = exchange_obj.fee;
                        exchange_obj.fee = amount;
                    } else {
                        exchange_obj.Actual_Amount = amount;
                    }
                }
                exchange_obj.Royalty = 0;
            } else if (receipt_box.length === 1){
                exchange_obj.Actual_Amount = String(set.data).substr(2, 64);
                exchange_obj.Actual_Amount = bigInt(exchange_obj.Actual_Amount, 16);
                exchange_obj.Actual_Amount = web3.utils.fromWei(String(exchange_obj.Actual_Amount), "ether");
                exchange_obj.fee = 0;
            }
        }
    });
    if (exchange_obj.Royalty === undefined){
        exchange_obj.Royalty = 0;
    }
    exchange_obj.Price = web3.utils.fromWei(String(Number(web3.utils.toWei(String(exchange_obj.Actual_Amount),'ether')) + Number(web3.utils.toWei(String(exchange_obj.fee),'ether')) + Number(web3.utils.toWei(String(exchange_obj.Royalty),'ether'))), 'ether')
    return exchange_obj;
}

async function Main(){
    if (Event_box.length > 0){
        let tx_log = await web3.eth.getTransactionReceipt(Event_box[0].transactionHash);
        let internal = await ETH_API.account.txlistinternal(Event_box[0].transactionHash, Event_box[0].from, Event_box[0].blockNumber, Event_box[0].blockNumber);
        let block_info = await web3.eth.getBlock(Event_box[0].blockNumber);
        let price = await web3.eth.getTransaction(Event_box[0].transactionHash);
        let time = block_info.timestamp*1000;
        let blocktime = new Date(time);
        blocktime = dateFormat('yyyy-MM-dd hh:mm:ss', blocktime);
        let receipt_box = [];
        let weth_box = [];
        let internal_box = [];
        let payment_method = " ";
        let result_obj = " ";

        tx_log.logs.map(txr => {
            if ((txr.address.toLowerCase() === CA721) || (txr.address.toLowerCase() === CA1155)){
                receipt_box.push(txr);
            }
            if (txr.address.toLowerCase() === WETH_CA){
                payment_method = "WETH";
                weth_box.push(txr);
            }
        });

        exchange_obj = pick_up_basic_data(receipt_box);
        //ETH payment
        if (Object.keys(exchange_obj).length === 0){
            console.log("Not Exchange Event");
        } else{
            internal.result.map(item => {
                if ((Number(item.value) > 0)  && (item.from.toLowerCase() === EXCHANGE_CA)){
                    internal_box.push(item);
                }
            });
        }
        if (payment_method != "WETH"){
            payment_method = "ETH";
        }

        switch(payment_method){
            case "ETH":
                result_obj = pick_up_ETH_payment_data(internal_box);
                break;
            case "WETH":
                result_obj = pick_up_WETH_payment_data(weth_box);
                break;
        }

        if (result_obj.Royalty_recipient === undefined){
            result_obj.Royalty_recipient = " ";
        }
        if (Tx_box.includes(Event_box[0].transactionHash) === true){
            console.log("Existing txid");
        } else{
            if (result_obj != " " && result_obj.Buyer != undefined){
                console.log(result_obj);
                if (payment_method === "ETH"){
                    if (price.value != undefined){
                        exchange_obj.Price = web3.utils.fromWei(price.value, 'ether');
                    }
                    Mysql.Insert_Exchange_Data(Event_box[0].blockNumber, Event_box[0].transactionHash, "Exchange", result_obj.Buyer, result_obj.Seller, result_obj.TokenID, result_obj.Value, result_obj.token_type, result_obj.Royalty + "ETH", result_obj.Royalty_recipient, exchange_obj.fee+ "ETH", exchange_obj.Actual_Amount+ "ETH", exchange_obj.Price+ "ETH", blocktime);
                    console.log("Save!");
                } else if(payment_method === "WETH"){
                    Mysql.Insert_Exchange_Data(Event_box[0].blockNumber, Event_box[0].transactionHash, "Exchange", result_obj.Buyer, result_obj.Seller, result_obj.TokenID, result_obj.Value, result_obj.token_type, result_obj.Royalty + "WETH", result_obj.Royalty_recipient, exchange_obj.fee+ "WETH", exchange_obj.Actual_Amount+ "WETH", exchange_obj.Price+ "WETH", blocktime);
                    console.log("Save!");
                }
            }
        }
        if (Tx_box.length >= 100){
            Tx_box.shift();
        } 
        Tx_box.push(Event_box[0].transactionHash);
        Event_box.shift();
    } else{
        console.log("Empty box");
    }
}

async function run(){
    console.log("RUN!");
    setInterval(Main, 3000);
}

run();