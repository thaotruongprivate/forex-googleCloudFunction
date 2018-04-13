OANDA FOREX TRADE MAKER
======

This is a small project that I hosted as a Google Cloud Function to help me execute forex trades on OANDA. It only works when your target is Oanda's API.

###How To Use

- upload this project to Cloud Source repository (or GitHub/BitBucket, but then you still need to clone it to Cloud Source Repository)
- create a Cloud Function with the source being that repository. The other way to source this function is Inline Editor, where you have to copy the content of index.js and package.json to the corresponding files
- after this is done, you can make trade by sending POST request to the HTTP trigger URL
- the POST body looks like this: 
```
{
  "action": "", 
  "baseUrl": "",
  "accountId": "",
  "apiKey": "",
  "override": {
    "risk": 0.01,
    "stopLoss": 30,
    "takeProfit": 40
  }
}
```
- Param explanation:
  - action: "buy" or "sell"
  - baseUrl: the base URL of Oanda API, for example: "https://api-fxpractice.oanda.com/v3/accounts"
  - accountId: your trading account ID
  - apiKey: this is needed for authorisation 
  - override: this is a list of options which will override the default options. These options are:
    - risk: the default amount of risk is 5% of your current balance, written as "0.05", you can change this to whatever you want which is below 1.
    - stopLoss: stop loss in pips. The default is 30
    - takeProfit: take profit in pips. The default is 40
- example response: 
  - 200
    ```
    {"tradeId":"1261","type":"buy","price":"1.23372","takeProfit":1.23772,"stopLoss":1.23072,"lotSize":0.06}
    ```
  - 400
    ```
    {"error":"Something is missing in the request"}
    {"error":"Wrong action"} // in case the action is neither "buy" nor "sell"
    ```