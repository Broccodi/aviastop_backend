const express = require("express");
const request = require('request');
const bodyParser = require('body-parser');
const moment = require('moment');
const async = require("async");
const app = express();

//BODY PARSER

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get("/", function(req, res ) {
    res.send('Hello there!')
});

app.get("/long_transfer", function(req, res) {

    let errors = false;
    let origin_city = '';
    let destination_city = '';
    let departure_date = '';
    let arrival_date = '';
    let one_way = true;
    let diff = 1;
    let result = {
        tickets: []
    };
    if (!req.query.origin) {
        res.send({error: "City of departure is not set"});
        errors = true
    } else {
        const options = {
            url: 'http://autocomplete.travelpayouts.com/places2',
            qs: {
                term: req.query.origin,
                locale: 'en',
                types: 'city',
            }
        };
        request.get(options, (error, response, body) => {
            if (!(error || response.statusCode !== 200)) {
                const obj = JSON.parse(body);
                origin_city = obj[0].code;
                if (!req    .query.destination) {
                    res.send({error: "City of arrival is not set"});
                    errors = true
                } else {
                    const options = {
                        url: 'http://autocomplete.travelpayouts.com/places2',
                        qs: {
                            term: req.query.destination,
                            locale: 'en',
                            types: 'city',
                        }
                    };
                    request.get(options, (error, response, body) => {
                        if (!(error || response.statusCode !== 200)) {
                            const obj = JSON.parse(body);
                            destination_city = obj[0].code;
                            if (!req.query.departure_date) {
                                res.send({error: "Departure date is not set"});
                                errors = true
                            } else {
                                departure_date = req.query.departure_date
                            }
                            if (req.query.arrival_date) {
                                arrival_date = req.query.arrival_date;
                                one_way = false
                            }
                            diff = moment(arrival_date).diff(moment(departure_date), 'days');

                            if (!errors) {
                                const options = {
                                    url: 'https://lyssa.aviasales.ru/v2/widget/month/',
                                    qs: {
                                        origin_iata: origin_city,
                                        destination_iata: destination_city,
                                        one_way: one_way.toString(),
                                        min_trip_duration: 1,
                                        max_trip_duration: diff.toString(),
                                        depart_month: departure_date
                                    }
                                };
                                request.get(options, (error, response, body) => {
                                    if (!(error || response.statusCode !== 200)) {
                                        const obj = JSON.parse(body);
                                        if (Object.keys(obj.errors).length === 0 && obj.errors.constructor === Object) {
                                            async.forEachOf(obj.month, (value, key, callback) => {
                                                if (moment(departure_date).diff(moment(key), 'days') < 7) {
                                                    if (obj.month[key].flights.length !=  0) {
                                                        obj.month[key].flights[0].forEach((flight) => {
                                                            if (flight.delay > 420) {
                                                                let flyObject = obj.month[key].flights[0];
                                                                let value = obj.month[key].value;
                                                                const options = {
                                                                    url: 'http://autocomplete.travelpayouts.com/places2',
                                                                    qs: {
                                                                        term: flight.origin,
                                                                        locale: 'en',
                                                                        types: 'city',
                                                                    }
                                                                };
                                                                request.get(options, (error, response, body) => {
                                                                    if (!(error || response.statusCode !== 200)) {
                                                                        const obj = JSON.parse(body);
                                                                        let cityName = obj[0].name.split(" ")[0];
                                                                        const options = {
                                                                            url: 'https://app.surprizeme.ru/api/products/',
                                                                            qs: {
                                                                                city: obj[0].name.split(" ")[0]
                                                                            }
                                                                        };
                                                                        request.get(options, (error, response, body) => {
                                                                            if (!(error || response.statusCode !== 200)) {
                                                                                const obj = JSON.parse(body);
                                                                                if (obj.data.length > 0) {
                                                                                    const resultObj = {
                                                                                        price: value,
                                                                                        flights: flyObject,
                                                                                        link: "https://surprizeme.ru/ru/" + cityName
                                                                                    };
                                                                                    console.log(resultObj);
                                                                                    result.tickets.push(resultObj);
                                                                                }
                                                                            } else {
                                                                                res.send({error: "City of departure is invalid"});
                                                                                errors = true
                                                                            }
                                                                        })
                                                                    } else {
                                                                        res.send({error: "City of departure is invalid"});
                                                                        errors = true
                                                                    }
                                                                })
                                                            }
                                                        })
                                                    } else {
                                                        res.send({error: "Something went wrong"});
                                                    }
                                                } else {
                                                    res.send({result: "No avaliable tickets"})
                                                }
                                                setTimeout(() => {
                                                    callback();
                                                }, 10000);
                                            }, err => {
                                                if (err) console.error(err.message);
                                                res.send(result)
                                            });
                                        } else {
                                            res.send(obj.errors)
                                        }
                                    } else {
                                        res.send(body)
                                    }
                                });
                            }
                        } else {
                            res.send({error: "City of departure is invalid"});
                            errors = true
                        }
                    });
                }
            } else {
                res.send({error: "City of departure is invalid"});
                errors = true
            }
        });
    }
});

app.listen(8080);
