const express = require('express')
const http = require('http')
const app = express()
const server = http.createServer(app)
const amqp = require('amqplib/callback_api')

import { Server } from 'socket.io'

const io = new Server(server,{
    cors : {
        origin: "https://the-board-client.vercel.app/",
    }
})

type Point = {x: number, y: number}

type DrawLine = {
    prevPoint: Point | null
    currentPoint: Point
    color: string
}

io.on('connection', (socket) => {
    console.log('connection')

    socket.on('client-ready', ()=>{
        socket.broadcast.emit('get-canvas-state')
    })

    socket.on('canvas-state', (state) => {
        socket.broadcast.emit('canvas-state-from-server', state)
    })
    socket.on('draw-line', ({prevPoint, currentPoint, color}: DrawLine) => {
        // socket.broadcast.emit('draw-line', {prevPoint, currentPoint, color})
        amqp.connect('amqp://localhost', (err: any, connection: { createChannel: (arg0: (err: any, channel: any) => void) => void; close: () => void }) => {
            if(err){
                throw err;
            }

            connection.createChannel((err, channel) => {
                if(err){
                    throw err;
                }
                let queueName = "drawQueue";
                let line = {prevPoint, currentPoint, color};
                channel.assertQueue(queueName, {
                    durable: false,
                });
                channel.sendToQueue(queueName, Buffer.from(JSON.stringify(line)));
                setTimeout(() => {
                    connection.close();
                }, 1000)
            })
        });
    })

    socket.on('clear', ()=> io.emit('clear'))
})

amqp.connect('amqp://localhost', (err: any, connection: { createChannel: (arg0: (err: any, channel: any) => void) => void; close: () => void }) => {
    if(err){
        throw err;
    }

    connection.createChannel((err, channel) => {
        if(err){
            throw err;
        }
        let queueName = "drawQueue";
        channel.assertQueue(queueName, {
            durable: false,
        });
        channel.consume(queueName, (msg: { content: { toString: () => any } }) => {
            // console.log(`Received: ${msg.content.toString()}}`);
            try {
                var line = JSON.parse(msg.content.toString());
                io.sockets.emit("draw-line", line);
            } catch (e) {
                console.error(e);
            }
        }, {
            noAck: true,
        })
    })
});

server.listen(3001, () => {
    console.log('Server listening on port 3001')
})
