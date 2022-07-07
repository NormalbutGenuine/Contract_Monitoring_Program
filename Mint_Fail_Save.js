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

// 같은 트랜잭션이 db에 저장되는 것을 막기 위한 배열
let Tx_box = [];

const CA721 = process.env.CA721_IN.toLowerCase();
const CA1155 = process.env.CA1155_IN.toLowerCase();

let Tx_list = [];
let Judge_box = [];

// 두 발행 콘트랙트의 모든 tx_hash를 반환하는 함수
async function Get_Tx_Data(){
    // 이미 저장된 hash 다음 번호부터 저장할 수 있도록 로직처리
    try{
        let Highest_BN = await Mysql.Get_BlockNum(4);
        let num = 0;
        if (Object.values(Highest_BN[0])[0] === "null"){
            num = 1;
        } else {
            num = Object.values(Highest_BN[0])[0]+1;
        }
        let Tx1 = await ETH_API.account.txlist(CA721, num, 'latest', 1, 10000, 'asc');
        let Tx2 = await ETH_API.account.txlist(CA1155, num, 'latest', 1, 10000, 'asc');

        for (var i = 0; i < Tx1.result.length; i++){
            Tx_box.push(Tx1.result[i].hash);
        }

        for (var j = 0; j < Tx2.result.length; j++){
            Tx_box.push(Tx2.result[j].hash);
        }
    }catch(e){
        if (e === "No transactions found"){
            console.log("There is no blockNumber higher than parameter.");
        }
    }
    return Tx_box
}

async function Find_Fail(){
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
                if (Tx_Rec.status === false && (Tx_list.includes(Tx_Rec.transactionHash) === false)){
                    console.log("Save here");
                    Mysql.Save_Fail_Mint(Tx_Rec.blockNumber, Tx_Rec.transactionHash, "Error",Tx_Rec.from, Tx_Rec.to, newtime);
                    Tx_list.push(Tx_Rec.transactionHash);
                    if (Tx_list.length >= 500){
                        Tx_list.shift();
                    }
                }else{
                    console.log("True");
                }
            }catch(e){
                console.log("ERROR IS"+e);
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
    setInterval(Find_Fail, 2000);
}

run();