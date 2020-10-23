const Web3 = require("web3")
const express = require('express'),
    bodyParser = require('body-parser'),
    http = require('http'),
    cors = require('cors');
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/v3/370caafe4c4f49018b488765fe49cea1"))
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: true,
    credentials: true
  }));
app.options('*', cors());
app.use(express.Router());


http.createServer(app).listen(4000, function () {
console.log('Express server listening on port 4000');
});


const output_format = {
	"block": {
		"blockHeight": ""
		},
	"outs": [],
	"ins": [],
	"hash":"",
	"currency": "ETH",
	"chain": "ETH.main",
	"state": "confirmed",
	"depositType": ""
}
const tokenTransferHash = Web3.utils.keccak256("Transfer(address,address,uint256)");

app.get("/eth/api/v1/transaction", function(req, res){
    var TxId = req.query.TxId;
    web3.eth.getTransactionReceipt(TxId).then((tx_receipt) => {
  //   	console.log("Transaction Receipt")
		// console.log(tx_receipt)
		// console.log("---------------------------------")
    	web3.eth.getTransaction(TxId, function(err, tx_details){
    		if(tx_details){
    			// console.log(" Transaction Details")
    			// console.log(tx_details)
    			// console.log("--------------------------------")
    			web3.eth.getCode(tx_details.to, function(er, codeAtToAddress){
    				if(er){
    					res.send(er);
    				}
    				else{
    					// console.log(" code at to address")
		    			// console.log(codeAtToAddress)
		    			// console.log("-----------------------------------")
		    			let result = format_result(tx_receipt, tx_details, codeAtToAddress);
		    			res.send(result);
    				}
    			});	
    		}
    		else{
    			res.send(err);
    		}
    		
    	})
    	
    })
    .catch((error) =>{
    	res.send(error);
    })
});


function format_result(tx_receipt , tx_details, codeAtToAddress){
	let temp = JSON.parse(JSON.stringify(output_format));
	temp.block.blockHeight = tx_receipt.blockNumber;
	temp.hash = tx_receipt.transactionHash;
	let from = web3.utils.toChecksumAddress(tx_details.from);
	let to = web3.utils.toChecksumAddress(tx_details.to);

	// If input is 0x then it is an ether transfer transaction either to an externally owned account or contract account
	// Value will alaways be non-zero if the transaction has got mined.
	if(tx_details.input =="0x") {
		temp.depositType = "account";
		var input = {
			"address":from,
			"value":(-1) * tx_details.value
		}
		var output = {
			"address": to,
			"value":tx_details.value
		}

	}

	// If the code at "to" address is not 0x then either it could be a contract creation or execution 
	// For ERC 20 token transfer transaction the topics will have 1 element which is the keccak hash of Transfer Event. The data field will contain the value
	// This isn't an erc20 exclusive check
	else if(codeAtToAddress != "0x"){

		// console.log("Topics");
		// console.log(tx_receipt.logs[0].topics.toString());
		// console.log("---------------------------");
		
		temp.depositType = "Contract";
		
		if(tx_receipt.logs[0].topics && tx_receipt.logs[0].topics[0] == tokenTransferHash) {
			let logs = tx_receipt.logs[0];
			let value = parseInt(logs.data, 16);
			let coinspecific = {
				"tokenAddress":logs.address
			};
			var output={

				"address":logs.topics[2],
				"value":value,
				"coinspecific":"",
				"type":"token"

			}
			var input={
				"address":from,
				"value":value,
				"coinspecific":"",
				"type":"token"
			}
			input.coinspecific = coinspecific;
			output.coinspecific = coinspecific;
		}
		// If code At to Address is not the input then it is a contract execution transaction
		// Here it is a Multisig transaction
		// Fetched Function Details from EtherScan
		// Function: sendMultiSig(address toAddress, uint256 value, bytes data, uint256 expireTime, uint256 sequenceId, bytes signature)
		// Function opcode = 0x39125215
		else {
			// TODO: Get the event details/parameters 
			let logs = tx_receipt.logs[0];
			var toAddress = tx_details.input.substring(10,74);
			var val = parseInt(tx_details.input.substring(74,138),16);
			let coinspecific = {
					"traceHash": tx_receipt.transactionHash };
			var input = {
				"address": tx_receipt.logs[0].address,
				"value": -1*val,
				"type": "transfer",
				"coinspecific": ""
			}
			var output = {
				"address": toAddress,
				"value": val,
				"type": "transfer",
				"coinspecific": ""
			}
			input.coinspecific = coinspecific;
			output.coinspecific = coinspecific;
		}
	}

	else{ 
		return ("An error occured");
	}
	temp.ins.push(input);
	temp.outs.push(output);
	return temp;

}