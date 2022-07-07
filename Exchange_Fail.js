const Web3 = require('web3');
var bigInt = require("big-integer");
var Mysql = require("./mysqldb/database");
var events = require("events");
var dateFormat = require("date-format");
require("dotenv").config();
const INFURA_KEY = process.env.INFURA_KEY;
const NETWORK = process.env.NETWORK;
let web3 = new Web3(new Web3.providers.HttpProvider(`https://${NETWORK}.infura.io/v3/${INFURA_KEY}`));
var ETH_API = require('etherscan-api').init(process.env.API_KEY, NETWORK);
const EXCHANGE_CA = process.env.CA_EXCHANGE.toLowerCase();

let Tx_list = [];
let Tx_box = [];
let Judge_box = [];

const EX_FAIL = 5;
// 두 발행 콘트랙트의 모든 tx_hash를 반환하는 함수
async function Get_Tx_Data(){
    try{
        let LastBN = await Mysql.Get_BlockNum(EX_FAIL);
        let num = 0;
        if (Object.values(LastBN[0])[0] === "null"){
            num = 1;
        } else {
            num = Object.values(LastBN[0])[0]+1;
        }
        let Tx = await ETH_API.account.txlist(EXCHANGE_CA, num, 'latest', 1, 10000, 'asc');
    
        for (var i = 0; i < Tx.result.length; i++){
            Tx_box.push(Tx.result[i].hash);
        }
        
    }catch(e){
        if (e === "No transactions found"){
            console.log("There is no blockNumber higher than parameter.");
        }
    }
    return Tx_box
}

async function Find_Exchange_Fail(){
    if ((Tx_box.length === 0) && (Judge_box.includes(1) === false)){
        await Get_Tx_Data();
    } else{
        if (Tx_box.length != 0){
            try{
                let Tx_Rec = await web3.eth.getTransactionReceipt(Tx_box[0]);
                let Block_info = await web3.eth.getBlock(Tx_Rec.blockNumber);
                let time = Block_info.timestamp*1000;
                let newtime = new Date(time);
                newtime = dateFormat('yyyy-MM-dd hh:mm:ss', newtime);
                let Amount_paid = await web3.eth.getTransaction(Tx_box[0]);
                let ETH_Amount = Number(Amount_paid.value)/10**18;
                let From = Tx_Rec.from;
                if (Tx_Rec.status === false && (Tx_list.includes(Tx_Rec.transactionHash) === false)){
                    console.log("Save here");
                    Mysql.Save_Fail_Exchange(Tx_Rec.blockNumber, Tx_Rec.transactionHash, "Error",Tx_Rec.from, Tx_Rec.to,ETH_Amount + "ETH", newtime);
                    Tx_list.push(Tx_Rec.transactionHash);
                    if (Tx_list.length >= 500){
                        Tx_list.shift();
                    }
                }else{
                    console.log("True");
                }
            }catch(e){
                console.log("ERROR IS" + e);
            }
        } else {
            console.log("Empty box");
        }
        Tx_box.shift();
    }
    Judge_box.push(1);
}

async function run(){
    console.log("Run");
    setInterval(Find_Exchange_Fail, 2000);
}

run();