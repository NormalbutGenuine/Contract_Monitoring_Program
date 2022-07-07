const Web3 = require('web3');
var bigInt = require("big-integer");
var Mysql = require("./mysqldb/database");
var events = require("events");
var dateFormat = require("date-format");
require("dotenv").config();
const INFURA_KEY = process.env.INFURA_KEY;
const NETWORK = process.env.NETWORK;
const XHR = require("xhr2-cookies").XMLHttpRequest;
let web3 = new Web3(new Web3.providers.HttpProvider(`https://${NETWORK}.infura.io/v3/${INFURA_KEY}`));
let web3ws = new Web3(new Web3.providers.WebsocketProvider(`wss://${NETWORK}.infura.io/ws/v3/${INFURA_KEY}`, {
    // @ts-ignore
    clientConfig: {
        maxReceivedFrameSize: 100000000*10,
        maxReceivedMessageSize: 100000000*10,
        keepalive: true,
        keepaliveInterval: 60000	// milliseconds
    }
}));

let Event_box = [];
// 같은 트랜잭션이 db에 저장되는 것을 막기 위한 배열
let Tx_box = [];
let return_box = [];
var em = new events.EventEmitter();

const CA721 = process.env.CA721_IN.toLowerCase();
const CA1155 = process.env.CA1155_IN.toLowerCase();
const TRANSFER_SINGLE_EVENT = process.env.TRANSFER_SINGLE_EVENT.toLowerCase();
const SUPPLY_EVENT = process.env.TOKEN_SUPPLY_EVENT.toLowerCase();
const TRANSFER_EVENT = process.env.TRANSFER_EVENT.toLowerCase();
const APPROVALFORALL_EVENT = process.env.APPROVALFORALL_EVENT.toLowerCase();
const APPROVE_EVENT = process.env.APPROVE_EVENT.toLowerCase();

const MINT= 1;
const APPROVAL = 3;

// 컨트랙트에서 넘어오는 데이터를 웹소켓통신으로 받아오는 함수
async function Subscribe_contract(){
    const BN_MINT = await Mysql.Get_BlockNum(MINT); // token_mint 테이블에 저장된 가장 큰 블록넘버를 가져오는 함수
    const BN_APPROVAL = await Mysql.Get_BlockNum(APPROVAL); // market_approval 테이블에 저장된 가장 큰 블록넘버를 가져오는 함수
    let num = 1;
    
    if ((Object.values(BN_MINT[0])[0] === "null") && (Object.values(BN_APPROVAL[0])[0] === "null")){
        num = 1;
    } else {
        if (Object.values(BN_MINT[0])[0] > Object.values(BN_APPROVAL[0])[0]){
            num = Object.values(BN_MINT[0])[0] + 1;
        } else {
            num = Object.values(BN_APPROVAL[0])[0] + 1;
        }
    }
    
    let options = {
        fromBlock: num,
        address: [CA721, CA1155],
        topics: [],
        clientConfig: {
            keepalive: true,
            keepaliveInterval: 60000	// milliseconds
        },
        reconnect: {
            auto: true,
            delay: 5000, //ms
            maxAttempts: 5,
            onTimeout: false
        }
    }

    let subscription = web3ws.eth.subscribe("logs", options, (err, event) => {
        if (!err){
            em.emit("data send", event);
        } else{
            console.log(err);
            // error detail 확인가능
            XHR.prototype._onHttpRequestError = function (request, err) {
                if (this._request !== request) {
                    return;
                }
                // A new line
                console.log(err, 'request')
                this._setError();
                request.abort();
                this._setReadyState(XHR.DONE);
                this._dispatchProgress('error');
                this._dispatchProgress('loadend');
            };
        }
    })
    
    subscription.on("data", event => {console.log("data")});
    subscription.on("changed", changed => console.log("changed: "+changed));
    subscription.on("error", err => console.log("error: "+err));
    subscription.on("connected", nr => console.log(nr));
}

setTimeout(() => Subscribe_contract(), 1);

em.on("data send", function(data){
    console.log("---------------------------- EVENT BOX ------------------------------");
    Event_box.push(data);
    console.log(Event_box.length);
})

function Data_pull_out(tx_Data){
    let save_Object = {};
    let approv_Object = {};
    for (var w = 0; w < tx_Data.logs.length; w++){
        // ERC721
        if (tx_Data.logs[w].topics[0] === TRANSFER_EVENT && (tx_Data.logs[w].topics.length === 4)){
            save_Object.TokenID = String(tx_Data.logs[w].topics[3]).substr(2, 64);
            save_Object.TokenID = bigInt(save_Object.TokenID, 16);
            save_Object.From = '0x'+ tx_Data.logs[w].topics[1].substr(26, 40);
            save_Object.To = '0x' + tx_Data.logs[w].topics[2].substr(26,40);
            save_Object.Value = "1";
            save_Object.TokenType = "ERC721";
            if (save_Object.From === "0x0000000000000000000000000000000000000000"){
                save_Object.Event = "Mint";
            } else {
                save_Object.Event = "Transfer";
            }
            save_Object.TotalSupply = null;
        }
        // ERC1155
        else if((tx_Data.logs[w].topics[0].toLowerCase() === TRANSFER_SINGLE_EVENT) && (tx_Data.logs[w].topics.length === 4)){
            save_Object.TokenID = String(tx_Data.logs[w].data).substr(2, 64);
            save_Object.TokenID = bigInt(save_Object.TokenID, 16);
            save_Object.To = '0x' + String(tx_Data.logs[w].topics[3]).substr(26, 40);
            save_Object.From = '0x' + String(tx_Data.logs[w].topics[2]).substr(26, 40);
            save_Object.Value = String(tx_Data.logs[w].data).substr(66, 64);
            save_Object.Value = bigInt(save_Object.Value, 16);
            save_Object.TokenType = "ERC1155";
            for (var p = 0; p < tx_Data.logs.length; p++){
                if (tx_Data.logs[p].topics[0].toLowerCase() === SUPPLY_EVENT){
                    save_Object.TotalSupply = String(tx_Data.logs[p].data).substr(66, 64);
                    save_Object.TotalSupply = bigInt(save_Object.TotalSupply, 16).value;
                } 
            }
            if (save_Object.TotalSupply === undefined){
                save_Object.TotalSupply = null;
            }
            if (save_Object.From === "0x0000000000000000000000000000000000000000" && save_Object.TotalSupply > 0){
                save_Object.Event = "Mint";
            } else {
                save_Object.Event = "Transfer";
            }
        }
        // Approval
        else if(tx_Data.logs[w].topics[0] === APPROVE_EVENT && tx_Data.logs[w].topics.length === 4){
            approv_Object.Event = "Approval";
            approv_Object.Owner = '0x'+ String(tx_Data.logs[w].topics[1]).substr(26,40);
            approv_Object.Approved = '0x' + String(tx_Data.logs[w].topics[2]).substr(26,40);
            approv_Object.Token_ID = String(tx_Data.logs[w].topics[3]).substr(2, 64);
            approv_Object.Token_ID = bigInt(approv_Object.Token_ID, 16);
            approv_Object.Operator = null;
        }
        // ApprovalForAll
        else if(tx_Data.logs[w].topics[0] === APPROVALFORALL_EVENT && tx_Data.logs[w].topics.length === 3){
            approv_Object.Event = "ApprovalForAll";
            approv_Object.Owner = '0x'+ String(tx_Data.logs[w].topics[1]).substr(26,40);
            approv_Object.Operator = '0x' + String(tx_Data.logs[w].topics[2]).substr(26,40);
            approv_Object.bool = String(tx_Data.logs[w].data).substr(2, 64);
            approv_Object.bool = parseInt(approv_Object.bool, 16);
            approv_Object.Token_ID = null;
            if (approv_Object.bool === 1){
                approv_Object.Approved = "True";
            }else{
                approv_Object.Approved = "False";
            }
        }else if ((approv_Object.Event === undefined) && w === tx_Data.logs.length - 1){
            approv_Object.Event = "Other Event";
        }
    }
    // 하나의 tx_Receipt에 approval 이벤트와 transfer 이벤트가 같이 존재할 경우, 마지막 이벤트로 객체가 초기화되면 이전 이벤트의 데이터가 사라지기 때문에 첫 번째 이벤트 데이터를 배열에 저장하는 코드.
    return_box.push(save_Object);
    return_box.push(approv_Object);
    return return_box;
}

async function Monitor_Mint_and_Transfer(){
    if (Event_box.length === 0){
        console.log("Empty box.");
    }else {
        let receipt = await web3.eth.getTransactionReceipt(Event_box[0].transactionHash);
        let Block_data = await web3.eth.getBlock(Event_box[0].blockNumber);
        let time = Block_data.timestamp*1000;
        let newtime = new Date(time);
        newtime = dateFormat("yyyy-MM-dd hh:mm:ss", newtime);
        if (Tx_box.includes(Event_box[0].transactionHash) === true){
            console.log("existing txid");
        } else{
            if (receipt != null){
                if (receipt.logs.length > 0){
                    let result = Data_pull_out(receipt);
                    for (var i = 0; i < result.length; i++){
                        if ((result[i].Event === "Mint" || result[i].Event === "Transfer") && Tx_box.includes(Event_box[0].transactionHash) === false) {
                            Mysql.Insert_Data(Event_box[0].transactionHash, Event_box[0].blockNumber , result[i].Event, result[i].From, result[i].To, result[i].TokenID, result[i].Value, result[i].TokenType, result[i].TotalSupply, newtime);
                            return_box = [];
                            console.log("Save!");
                        } else if((result[i].Event === "Approval" || result[i].Event === "ApprovalForAll") && Tx_box.includes(Event_box[0].transactionHash) === false) {
                            Mysql.Save_Approve_data(Event_box[0].blockNumber, Event_box[0].transactionHash, result[i].Event, result[i].Owner, result[i].Operator, result[i].Approved, receipt.to, result[i].Token_ID, newtime);
                            return_box = [];
                            console.log("Save!");
                        }
                    }
                }
            } else{
                console.log("Empty box");
            }
        }
        
        Tx_box.push(Event_box[0].transactionHash);
        if (Tx_box.length > 100){
            Tx_box.shift();
        }
    } 
    Event_box.shift();
}

async function run(){
    console.log("RUN!!");
    setInterval(Monitor_Mint_and_Transfer, 3000);
}

run();