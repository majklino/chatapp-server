// User.findOne({ screen_name: response['response'].toLowerCase() })
//                     .then((foundUser) => {
//                         if (!foundUser) {
//                             var newUser = new User({
//                                 screen_name: response['response'].toLowerCase()
//                             });
//                             newUser.save();
//                         }
//                     });


const express = require('express');
const config = require('config');

const log = require('../../helpers/logger');
const sqlService = require('../../model/master/sql-service');
const Message = require('../../model/core/schemas/messages');
const getWebSocketHub = require('../../hubs/web-socket-hub')

const webSocketHub = getWebSocketHub(null);
const router = express.Router();

router.post('/send', async function (req, res) {

    const requestData = req.body;
    let from = requestData.from;
    let to = requestData.to;
    let content = requestData.content;
    let online_uuid = requestData.online_uuid;

    log.info('sendin msg...');
    log.info('from: ' + from);
    log.info('to: ' + to);
    log.info('content: ' + content);
    log.info('uuid: ' + online_uuid);

    if (from == null) {
        res.json({ error: { status: "SENDER NOT SPECIFIED" } });
    }
    else if (to == null) {
        res.json({ error: { status: "RECEIVER NOT SPECIFIED" } });
    }

    await sqlService.connect();
    let senderAuthorized = await sqlService.checkUserAuthorization(from, online_uuid);
    //TODO check existence of receiver
    await sqlService.disconnect();

    if (senderAuthorized) {
        let newMessage = new Message({
            from: from,
            to: to,
            content: content
        });
        newMessage.save()
            .then(savedUser => {
                let msgJson = {
                    type: "MESSAGE RECEIVED",
                    from: from,
                    to: to,
                    content: content,
                }
                msgJson = JSON.stringify(msgJson);
                webSocketHub.broadcastMessageToAll(msgJson);
                res.json({ success: { status: "MESSAGE SENT" } });
            })
            .catch(error => {
                res.json({ error: { status: "MESSAGE NOT SENT" } });
            });
    }
    else {
        res.json({ error: { status: "NOT AUTHORIZED" } });
    }
});

router.get('/messages', async function (req, res) {
    const requestData = req.query;
    let from = requestData.from;
    let to = requestData.to;
    let online_uuid = requestData.online_uuid;

    log.info('calling to get msgs...');
    log.info('from: ' + from);
    log.info('to: ' + to);
    log.info('uuid: ' + online_uuid);

    if (from == null) {
        res.json({ error: { status: "SENDER NOT SPECIFIED" } });
    }
    else if (to == null) {
        res.json({ error: { status: "RECEIVER NOT SPECIFIED" } });
    }

    await sqlService.connect();
    let senderAuthorized = await sqlService.checkUserAuthorization(from, online_uuid);
    //TODO check existence of receiver
    await sqlService.disconnect();

    if (senderAuthorized) {
        const query = {
            $or: [
              { from: from, to: to },
              { from: to, to: from }
            ]
          };

        Message.find(query)
            .then(messages => {
                res.json({ success: { status: "MESSAGES OBTAINED", messages: messages } });
            })
            .catch(error => {
                res.json({ error: { status: "MESSAGES NOT OBTAINED" } });
            });
    }
    else {
        res.json({ error: { status: "NOT AUTHORIZED" } });
    }
});

module.exports = router;
