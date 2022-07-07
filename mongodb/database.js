var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/PentaDB');

var db = mongoose.connection;

db.on('error', function(error){
    console.log("Conenction Failed!");
});

db.once('open', function() {
    console.log('Connected!');
});

var Transfer_And_Mint = mongoose.Schema({
    blockNumber: 'number',
    Tx_Hash: 'string',
    Event: 'string',
    From: 'string',
    To: 'string',
    TokenID: 'string',
    Token_Amount: 'string',
    Token_Supply: 'string',
    Token_Type: 'string',
    TimeStamp: 'string'
})

var Transfer_And_Mint_Model = mongoose.model("Transfer_and_Mint_Penta", Transfer_And_Mint);

async function Save_Transfer_And_Mint(blockNumber_in, Tx_Hash_in, Event_in, From_in, To_in, TokenID_in, Token_Amount_in, Token_Supply_in, Token_Type_in, TimeStamp_in){
    var new_Penta_Transfer_And_Mint = new Transfer_And_Mint_Model({blockNumber: blockNumber_in, Tx_Hash: Tx_Hash_in, Event: Event_in, From: From_in, To: To_in, TokenID: TokenID_in, Token_Amount: Token_Amount_in, Token_Supply: Token_Supply_in, Token_Type: Token_Type_in, TimeStamp: TimeStamp_in});
    new_Penta_Transfer_And_Mint.save(function(error, data){
        if (error){
            console.log(error);
        }else{
            console.log("Saved!");
        }
    })
}

async function Find_BlockNumber(){
    let blockData1 = await Transfer_And_Mint_Model.find().sort({"blockNumber":-1}).limit(1);
    let blockData2 = await Transfer_And_Mint_Model.find().sort({"blockNumber":-1}).limit(1);
    let box = [];
    box.push(blockData1);
    box.push(blockData2);
    return box;
}

var Exchange_data = mongoose.Schema({
    blockNumber: 'number',
    Tx_Hash: 'string',
    Event: 'string',
    Buyer: 'string',
    Seller: 'string',
    TokenID: 'string',
    Token_Amount: 'string',
    Token_Type: 'string',
    Price: 'string',
    TimeStamp: 'string'
})

var Exchange_Collection = mongoose.model("Exchange_Penta", Exchange_data);

async function Save_Exchange_Data(blockNumber_in, Tx_Hash_in, Event_in, Buyer_in, Seller_in, TokenID_in, Token_Amount_in, Token_Type_in, Price_in, TimeStamp_in){
    var new_Exchange_Collection = new Exchange_Collection({blockNumber: blockNumber_in, Tx_Hash: Tx_Hash_in, Event: Event_in, Buyer: Buyer_in, Seller: Seller_in, TokenID: TokenID_in, Token_Amount: Token_Amount_in, Token_Type: Token_Type_in, Price: Price_in, TimeStamp: TimeStamp_in})
    new_Exchange_Collection.save(function(error, data){
        if (error){
            console.log(error);
        }else{
            console.log("Saved!");
        }
    })
}

var Approval_Data = mongoose.Schema({
    blockNumber: 'number',
    Tx_Hash: 'string',
    Event: 'string',
    Owner: 'string',
    Operator: 'string',
    Approved: 'string',
    Token_ID: 'string',
    CA: 'string',
    TimeStamp: 'string'
})

var Approval_Data_Model = mongoose.model("Approval_Document", Approval_Data);

async function Save_Approval_Data(blockNumber_in, Tx_Hash_in, Event_in, Owner_in, Operator_in, Approved_in, TokenID_in, CA_in, TimeStamp_in){
    var new_Approval_Model = new Approval_Data_Model({blockNumber: blockNumber_in, Tx_Hash: Tx_Hash_in, Event: Event_in, Owner: Owner_in, Operator: Operator_in, Approved: Approved_in, Token_ID: TokenID_in, CA:CA_in, TimeStamp: TimeStamp_in});
    new_Approval_Model.save(function(error, data){
        if (error){
            console.log(error);
        }else{
            console.log("Saved!");
        }
    })
}

async function Find_BlockNumber2(){
    let BN = await Approval_Data_Model.find().sort({"blockNumber":-1}).limit(1);
    return BN;
}

var Mint_Fail_Data = mongoose.Schema({
    blockNumber: 'number',
    Tx_Hash: 'string',
    status: 'string',
    From: 'string',
    CA: 'string',
    TimeStamp: 'string'
})

var Mint_Fail_Model = mongoose.model("Mint_Fail_Document", Mint_Fail_Data);

async function Save_Mint_Fail(blockNumber_in, Tx_Hash_in, status_in, From_in,  CA_in, TimeStamp_in){
    var new_Mint_Fail_Model = new Mint_Fail_Model({blockNumber: blockNumber_in, Tx_Hash: Tx_Hash_in, status: status_in, From: From_in, CA:CA_in, TimeStamp: TimeStamp_in});
    new_Mint_Fail_Model.save(function(error, data){
        if (error){
            console.log(error);
        }else{
            console.log("Saved!");
        }
    })
}

var Exchange_Fail_Data = mongoose.Schema({
    blockNumber: 'number',
    Tx_Hash: 'string',
    status: 'string',
    signer: 'string',
    value: 'string',
    From: 'string',
    CA: 'string',
    TimeStamp: 'string'
})

var Exchange_Fail_Model = mongoose.model("Exchange_Fail_Document", Exchange_Fail_Data);

async function Save_Exchange_Fail(blockNumber_in, Tx_Hash_in, status_in, signer_in, value_in, From_in, CA_in, TimeStamp_in){
    var new_Exchange_Fail_Model = new Exchange_Fail_Model({blockNumber: blockNumber_in, Tx_Hash: Tx_Hash_in, status: status_in, signer:signer_in, value: value_in, From: From_in, CA:CA_in, TimeStamp: TimeStamp_in});
    new_Exchange_Fail_Model.save(function(error, data){
        if (error){
            console.log(error);
        }else{
            console.log("Saved!");
        }
    })
}

async function Find_EX_BlockNumber(){
    let blockData1 = await Exchange_Collection.find().sort({"blockNumber":-1}).limit(1);
    
    return blockData1[0].blockNumber;
}

var test = mongoose.Schema({
    blockNumber: 'number',
    Tx_Hash: "string"
})

var test_model = mongoose.model("test", test);

module.exports = {
    Find_BlockNumber, Save_Exchange_Data, Save_Approval_Data, Find_BlockNumber2, Save_Mint_Fail, Mint_Fail_Model, Save_Exchange_Fail, Find_EX_BlockNumber, Penta_test_model, Save_Transfer_And_Mint
}

// Penta_Transfer_And_Mint1155_Collection.find({blockNumber: 9231889}).then((x) => {
//     console.log(x.length);
// });