const mysql = require("mysql2/promise");
const pool = require("./lib/pool");
let timez = require("moment-timezone");

const MINT = 1;
const EXCHANGE = 2;
const APPROVAL = 3;
const MINT_FAIL = 4;
const EX_FAIL = 5;
const TEST_EX = 6;

async function Insert_Data(Tx_Hash , blockNumber, event, From, To, TokenID, Token_Amount, Token_Type, Token_Supply, TimeStamp){
    let info = null;
    let moment = new Date();
    let now = timez.tz(moment, "Asia/Seoul").format("yyyy-MM-DD HH:mm:ss");
    let sql = '';
    sql = ` INSERT INTO tx_token_mint (tx_hash, blocknumber,  eventname, from_address, to_address, tokenid, token_amount, token_type, token_supply, blocktime, created_at) VALUES ("${Tx_Hash}", ${blockNumber},  "${event}", "${From}", "${To}", "${TokenID}", "${Token_Amount}", "${Token_Type}", "${Token_Supply}", "${TimeStamp}", "${now}") ;`;
    let connect = await pool.getConnection(async conn => conn);
    try{
        await connect.beginTransaction();
        info = await connect.query(sql);
        await connect.commit();
    }catch(e){
        console.log(e);
        if (connect){
            await connect.rollback();
            console.log("Rollback");
        }
    }finally{
        if(connect){
            await connect.release();
        }
    }
    return info;
}

async function Insert_Exchange_Data(blockNumber, Tx_Hash, event, Buyer, Seller, tokenid, value, token_type, royalty, royalty_recipient, fee, Actual_Amount, price, blocktime){
    let info = null;
    let moment = new Date();
    let now = timez.tz(moment, "Asia/Seoul").format("yyyy-MM-DD HH:mm:ss");
    let sql = '';
    sql = `INSERT INTO tx_market_exchange (blocknumber, tx_hash, event, buyer, seller, tokenid, value, token_type, royalty, royalty_recipient, fee, actual_amount, price, blocktime, created_at) VALUES (${blockNumber}, "${Tx_Hash}", "${event}", "${Buyer}", "${Seller}", "${tokenid}", "${value}", "${token_type}", "${royalty}", "${royalty_recipient}", "${fee}", "${Actual_Amount}", "${price}", "${blocktime}", "${now}") ; `;
    let connect = await pool.getConnection(async conn => conn);
    try{
        await connect.beginTransaction();
        info = await connect.query(sql);
        await connect.commit();
    }catch(e){
        console.log(e);
        if (connect){
            await connect.rollback();
            console.log("Rollback");
        }
    }finally{
        if(connect){
            await connect.release();
        }
    }
    return info;
}

async function Get_BlockNum(table){
    let info = null;
    let sql = null;
    switch (table) {
        case MINT:
            sql = `SELECT MAX(blocknumber) FROM tx_token_mint ;`;
            break;
        
        case EXCHANGE:
            sql = `SELECT MAX(blocknumber) FROM tx_market_exchange ;`;
            break;
        
        case APPROVAL:
            sql = `SELECT MAX(blockNumber) FROM tx_market_approval ;`;
            break;
        
        case MINT_FAIL:
            sql = `SELECT MAX(blockNumber) FROM tx_fail_mint ;`;
            break;
        
        case EX_FAIL:
            sql = `SELECT MAX(blocknumber) FROM tx_fail_exchange ;`;
            break;
        
        case TEST_EX:
            sql = `SELECT MAX(blockNumber) FROM tx_test_exchange ; `;
            break;
    }
    connect = await pool.getConnection(async conn => conn);
    try{
        await connect.beginTransaction();
        info = await connect.query(sql);
        await connect.commit();
    }catch(e){
        console.log(e);
        await connect.rollback();
    }
    finally{
        if(connect){
            await connect.release();
        }
    }
    return info[0];
}

async function Save_Fail_Mint(blockNumber, tx_hash, status, signer, contract_addr, blocktime){
    let info = null;
    let moment = new Date();
    let now = timez.tz(moment, "Asia/Seoul").format("yyyy-MM-DD HH:mm:ss");
    let sql = ` INSERT INTO tx_fail_mint (blocknumber, tx_hash, status,signer, contract_addr, blocktime, created_at) VALUES (${blockNumber}, "${tx_hash}", "${status}", "${signer}", "${contract_addr}", "${blocktime}", "${now}") ;`;
    let connect = await pool.getConnection(async conn => conn);
    try{
        await connect.beginTransaction();
        await connect.query(sql);
        await connect.commit();
    }catch(e){
        console.log(e);
        if (connect){
            await connect.rollback();
            console.log("Rollback");
        }
    }finally{
        if(connect){
            await connect.release();
        }
    }
}

async function Save_Fail_Exchange(blockNumber, tx_hash, status, signer, contract_addr, price, blocktime){
    let info = null;
    let moment = new Date();
    let now = timez.tz(moment, "Asia/Seoul").format("yyyy-MM-DD HH:mm:ss");
    let sql = `INSERT INTO tx_fail_exchange (blocknumber, tx_hash, status, signer, contract_addr, cancel_payment, blocktime, created_at) VALUES (${blockNumber}, "${tx_hash}", "${status}" ,"${signer}", "${contract_addr}", "${price}", "${blocktime}", "${now}") ;`;
    let connect = await pool.getConnection(async conn => conn);
    try{
        await connect.beginTransaction();
        await connect.query(sql);
        await connect.commit();
    }catch(e){
        console.log(e);
        if (connect){
            await connect.rollback();
            console.log("Rollback");
        }
    }finally{
        if(connect){
            await connect.release();
        }
    }
}

// async function Save_Approval_Data(blockNumber_in, Tx_Hash_in, Event_in, Owner_in, Operator_in, Approved_in, TimeStamp_in)
async function Save_Approve_data(blockNumber, Tx_Hash, Event, Owner, Operator, Approved, CA, TokenID, TimeStamp){
    let info = null;
    let moment = new Date();
    let now = timez.tz(moment, "Asia/Seoul").format("yyyy-MM-DD HH:mm:ss");
    let sql = `INSERT INTO tx_market_approval (blocknumber, tx_hash, event, owner, operator, approved,ca, tokenid, blocktime, created_at) VALUES (${blockNumber}, "${Tx_Hash}", "${Event}", "${Owner}", "${Operator}", "${Approved}", "${CA}", "${TokenID}", "${TimeStamp}", "${now}") ;`;
    let connect = await pool.getConnection(async conn => conn);
    try{
        await connect.beginTransaction();
        await connect.query(sql);
        await connect.commit();
    }catch(e){
        console.log(e);
        if (connect){
            await connect.rollback();
            console.log("Rollback");
        }
    }finally{
        if(connect){
            await connect.release();
        }
    }
}

async function test_Insert(blockNumber, Tx_Hash, event, Buyer, Seller, tokenid, value, token_type, royalty, royalty_recipient, fee, Actual_Amount, price, blocktime) {
    let info = null;
    let sql = '';
    sql = `INSERT INTO tx_test_exchange (blocknumber, tx_hash, event, buyer, seller, tokenid, value, token_type, royalty, royalty_recipient, fee, actual_amount, price, blocktime, created_at) VALUES (${blockNumber}, "${Tx_Hash}", "${event}", "${Buyer}", "${Seller}", "${tokenid}", "${value}", "${token_type}", "${royalty}", "${royalty_recipient}", "${fee}", "${Actual_Amount}", "${price}", "${blocktime}", NOW()) ; `;
    let connect = await pool.getConnection(async conn => conn);
    try{
        await connect.beginTransaction();
        info = await connect.query(sql);
        await connect.commit();
    }catch(e){
        console.log(e);
        if (connect){
            await connect.rollback();
            console.log("Rollback");
        }
    }finally{
        if(connect){
            await connect.release();
        }
    }
    return info;
}

module.exports = {
    Insert_Data, Insert_Exchange_Data, Get_BlockNum, Save_Fail_Mint, Save_Fail_Exchange, Save_Approve_data, test_Insert
}