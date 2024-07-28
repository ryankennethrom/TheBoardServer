import express from 'express'
import http from 'http'
const app = express()
const server = http.createServer(app)
import amqp from 'amqplib/callback_api'

import { Server } from 'socket.io'
import { drawLine } from './drawLine'

const io = new Server(server,{
    cors : {
        origin: "*",
    },
})

type Point = {x: number, y: number}

type DrawLine = {
    prevPoint: Point | null
    currentPoint: Point
    color: string
}

import { createCanvas, loadImage } from 'canvas';
import fs from "fs";
var canvas = createCanvas(750,750);
const ctx = canvas.getContext('2d');

var image_path = './image.png';

if(fs.existsSync(image_path)){
    loadImage(image_path).then((image) => {
        ctx.drawImage(image, 0, 0);
        setUpServer();
    })
}  else {
    setUpServer();
}

function setUpServer() {
    io.on('connection', (socket) => {
        console.log('connection')
    
        socket.on('client-ready', ()=>{
            socket.emit('server-ready');
            var base64img = canvas.toDataURL("image/png");
            socket.emit("canvas-update", base64img);

            amqp.connect('amqps://zqbfhloc:pOm_T3J-SMNSvruZvGi_DjtFZQvNk2dQ@codfish.rmq.cloudamqp.com/zqbfhloc', (err: any, connection: { createChannel: (arg0: (err: any, channel: any) => void) => void; close: () => void }) => {
                if(err){
                    throw err;
                }
    
                connection.createChannel((err, channel) => {
                    if(err){
                        throw err;
                    }
                    socket.on('draw-line', ({prevPoint, currentPoint, color}: DrawLine) => {
                        let queueName = "drawQueue";
                        let line = {prevPoint, currentPoint, color};
                        channel.assertQueue(queueName, {
                            durable: false,
                        });
                        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(line)));
                        // setTimeout(() => {
                        //     connection.close();
                        // }, 1000)
                    })
                })
            });
        })
    
        // socket.on('canvas-state', (state) => {
        //     socket.broadcast.emit('canvas-state-from-server', state)
        // })
    
        socket.on('clear', ()=> io.emit('clear'))
    })
    
    amqp.connect('amqps://zqbfhloc:pOm_T3J-SMNSvruZvGi_DjtFZQvNk2dQ@codfish.rmq.cloudamqp.com/zqbfhloc', (err: any, connection: { createChannel: (arg0: (err: any, channel: any) => void) => void; close: () => void }) => {
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
                try {
                    var {prevPoint, currentPoint, color} = JSON.parse(msg.content.toString());
                    if(!ctx)return
                    drawLine({prevPoint, currentPoint, ctx, color});
                    // io.sockets.emit("draw-line", {prevPoint, currentPoint, color});
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

    setInterval(saveImage, 10000)
}

function saveImage(){
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync("./image.png", buffer);
}