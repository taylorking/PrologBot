'use strict';

const doc = require('aws-sdk');

const dynamo = new doc.DynamoDB();
const TelegramBot = require('node-telegram-bot-api');
const token = 'dont put this in version control';
const bot = new TelegramBot(token, { polling: false});
const uuid = require('uuid');
const Prolog = require('jsprolog').default;

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    var type = -1;
    if (event.message.text.match("^\/rule[^s].*$") !== null) {
      createRule(context, event);
    }
    if (event.message.text.match("^\/rules.*$") !== null) {
      getRules(context, event);
    }
    if (event.message.text.match("^\/delete.*$") !== null) {
      deleteRule(context, event);
    }
    if (event.message.text.match("^\/eval.*$") !== null) {
      runQuery(context, event);
    }
};

function createRule(context, event) {
  var ruleText = event.message.text.slice(6);
  var id = uuid();
  var params = { 
    Item: {
      ruleText: {
        S: ruleText
      },
      chatId: { 
        N: JSON.stringify(event.message.chat.id)
      },
      ruleId: {
        S: id
      }      
    }, 
    TableName: 'prologRules'
  };
  console.log(params);
  dynamo.putItem(params, function(err, data) { 
    console.log("DynamoDB error: " + err);
    console.log("DynamoDb result: " + data);
    context.succeed();
  });
}

function deleteRule(context, event) {
  var id = event.message.text.slice(8);
  var params = { 
    TableName: 'prologRules',
    Key: { 
      ruleId: {
        S: id
      }
    }
  }
  console.log(params);
  dynamo.deleteItem(params, function(err, data) {
    context.succeed();
  });

}

function getRules(context, event) {
  var params = { 
    TableName: 'prologRules',
    FilterExpression: "chatId = :currentChat",
    ExpressionAttributeValues: {
      ":currentChat":{ 
        N: JSON.stringify(event.message.chat.id)
      }
    }
  }
  dynamo.scan(params, function(err, data) {
    var items = {};
    data.Items.forEach((item) => {
        items[item.ruleId.S] = item.ruleText.S;
    });
    bot.sendMessage(event.message.chat.id, JSON.stringify(items)).then(() => { 
      context.succeed();
    });
  });
}

function runQuery(context, event) {
  var params = {
    TableName: 'prologRules',
    FilterExpression: "chatId = :currentChat",
    ExpressionAttributeValues: {
      ":currentChat":{ 
        N: JSON.stringify(event.message.chat.id)
      }
    }
  }
  dynamo.scan(params, function(err, data) {
    var rules = data.Items.map((item) => {
      return item.ruleText.S;
    });
    var str = "";
    rules.sort();
    rules.forEach((rule) => {
        str += "\n" + rule;
    });
    var result = runPl(event, str);
    console.log("Result: " + result);
    bot.sendMessage(event.message.chat.id, JSON.stringify(result)).then(() => {
      context.succeed();
    });
  });
}

function runPl(event, rules) {
  console.log("rules: " + rules.toString());
  var db = Prolog.Parser.parse(rules.toString());
  var q = event.message.text.slice(5);
  console.log("query: " + q);
  var query = Prolog.Parser.parseQuery(q);
  var iter = Prolog.Solver.query(db, query);
  return solved(iter);
}
function solved(iter) {
    while (iter.next()) {
		  return iter.current;
    }
    return false;
}

/**
    const operation = event.operation;
    const payload = event.payload;

    if (event.tableName) {
        payload.TableName = event.tableName;
    }

    switch (operation) {
        case 'create':
            dynamo.putItem(payload, callback);
            break;
        case 'read':
            dynamo.getItem(payload, callback);
            break;
        case 'update':
            dynamo.updateItem(payload, callback);
            break;
        case 'delete':
            dynamo.deleteItem(payload, callback);
            break;
        case 'list':
            dynamo.scan(payload, callback);
            break;
        case 'echo':
            callback(null, payload);
            break;
        case 'ping':
            callback(null, 'pong');
            break;
        default:
            callback(new Error(`Unrecognized operation "${operation}"`));
    }
    **/
