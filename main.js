const request = require('request');

class Utils {
    constructor(apiKey, accountId, baseUrl) {
        this.config = {
            risk: 0.05,
            stopLoss: 30,
            takeProfit: 40,
            apiKey,
            accountId,
            baseUrl
        };

        this.headers = {
            Authorization: `Bearer ${this._getConfig().apiKey}`,
            "Content-Type": "application/json",
            "Accept-Datetime-Format": "Unix",
            Accept: "application/json"
        };
    }

    _getConfig() {
        return Object.assign(this.config);
    }

    _get(url, callback) {
        request.get({
            uri: url,
            headers: this.headers
        }, (err, res, body) => {
            this._responseHandler(err, res, body, callback);
        });
    }

    _post(url, data, callback) {
        request.post(
            {
                uri: url,
                json: data,
                headers: this.headers
            },
            (err, res, body) => {
                this._responseHandler(err, res, body, callback);
            }
        );
    }

    _put(url, data, callback) {
        request.put(
            {
                uri: url,
                json: data,
                headers: this.headers
            },
            (err, res, body) => {
                this._responseHandler(err, res, body, callback);
            }
        );
    }

    _getCurrentPrice(callback) {
        const config = this._getConfig();
        this._get(`${config.baseUrl}/${config.accountId}/pricing?instruments=EUR_USD`, (body) => {
            callback(body.prices[0].bids[0].price);
        });
    }

    _getCurrentBalance(callback) {
        const config = this._getConfig();
        this._get(`${config.baseUrl}/${config.accountId}`, (body) => {
            callback(body.account.balance);
        })
    }

    _getValuePerPip(callback) {
        this._getCurrentPrice((price) => {
            callback(10 / price);
        })
    }

    _getLotSize(callback) {
        const config = this._getConfig();
        this._getCurrentBalance(balance => {
            this._getValuePerPip(value => {
                const lotSize = balance * config.risk / (value * config.stopLoss);
                callback(Math.round(lotSize * 100) / 100);
            })
        })
    }

    _getTrades(callback) {
        const config = this._getConfig();
        this._get(`${config.baseUrl}/${config.accountId}/trades?state=OPEN&count=500`, (body) => {
            callback(body.trades);
        })
    }

    _closeTrade(tradeId, callback) {
        const config = this._getConfig();
        this._put(`${config.baseUrl}/${config.accountId}/trades/${tradeId}/close`, {units: 'ALL'}, () => {
            callback();
        });
    }

    _closeAllTrades(callback) {
        this._getTrades(trades => {
            if (trades.length === 0) {
                console.log("No trades to be closed");
                callback();
            } else {
                let closedTrades = 0;
                for (let trade of trades) {
                    this._closeTrade(trade.id, () => {
                        console.log(`Trade [${trade.id}] was closed`);
                        closedTrades++;
                        if (closedTrades === trades.length) {
                            callback();
                        }
                    });
                }
            }
        })
    }

    _getTakeProfitAndStopLoss(type, price) {

        price = parseFloat(price);

        const config = this._getConfig();
        const pip = 0.0001;
        let stopLoss = price + config.stopLoss * pip;
        let takeProfit = price - config.takeProfit * pip;

        if (type === 'buy') {
            stopLoss = price - config.stopLoss * pip;
            takeProfit = price + config.takeProfit * pip;
        }

        stopLoss = Math.round(stopLoss * 100000) / 100000;
        takeProfit = Math.round(takeProfit * 100000) / 100000;

        return {
            stopLoss,
            takeProfit
        };
    }

    _addProfitAndStopLossToTrade(tradeId, type, price, callback) {
        const config = this._getConfig();
        const profitAndStopLoss = this._getTakeProfitAndStopLoss(type, price);
        this._put(
            `${config.baseUrl}/${config.accountId}/trades/${tradeId}/orders`,
            {
                takeProfit: {
                    price: `${profitAndStopLoss.takeProfit}`
                },
                stopLoss: {
                    price: `${profitAndStopLoss.stopLoss}`
                }
            },
            callback
        );
    }

    makeTrade(type, callback) {

        const utils = this;

        const config = this._getConfig();
        this._closeAllTrades(() => {
            this._getLotSize(lotSize => {
                this._post(`${config.baseUrl}/${config.accountId}/orders`,
                    {
                        order: {
                            type: 'MARKET',
                            instrument: 'EUR_USD',
                            units: Math.round(lotSize * 100000) * (type === 'buy' ? 1 : -1)
                        }
                    },
                    body => {

                        const tradeId = body.orderFillTransaction.tradeOpened.tradeID;
                        const price = body.orderFillTransaction.tradeOpened.price;

                        const tpAndSl = utils._getTakeProfitAndStopLoss(type, price);
                        utils._addProfitAndStopLossToTrade(tradeId, type, price, () => {
                            callback({
                                tradeId,
                                type,
                                price,
                                takeProfit: tpAndSl.takeProfit,
                                stopLoss: tpAndSl.stopLoss,
                                lotSize
                            });
                        });
                    }
                );
            });
        });
    }

    _responseHandler(err, res, body, callback) {
        if (err) {
            return console.error(err);
        }
        if (res.statusCode !== 200 && res.statusCode !== 201) {
            return console.error(body);
        }
        if (this._isJsonString(body)) {
            callback(JSON.parse(body));
        } else {
            callback(body);
        }
    }

    _isJsonString(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    };
}

exports.trade = (req, response) => {

    response.setHeader('content-type', 'application/json');

    if (req.body.action && req.body.apiKey && req.body.accountId && req.body.baseUrl) {
        switch (req.body.action) {
            case 'buy':
            case 'sell':
                const utils = new Utils(
                    req.body.apiKey,
                    req.body.accountId,
                    req.body.baseUrl
                );
                utils.makeTrade(req.body.action, (trade) => {
                    return response.status(200)
                        .send(JSON.stringify(trade));
                });
                break;
            default:
                response.status(400).send(JSON.stringify(
                    {
                        error: 'Wrong action'
                    }
                ));
        }
    } else {
        response.status(400).send(JSON.stringify(
            {
                error: 'Something is missing in the request'
            }
        ));
    }
};