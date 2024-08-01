import express from 'express';
import http from 'http';
import amqp from 'amqplib/callback_api';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { drawLine } from './drawLine';
import { Canvas, Image, createCanvas, loadImage } from 'canvas';
import fs from "fs";
import CanvasImage from "./canvasImages";

const app = express()
const server = http.createServer(app)

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

const dbURI = 'mongodb+srv://ryanrom14nalt:QHbBk0DioS1cuPyC@cluster0.gwvon2w.mongodb.net/TheBoard';
var canvas = createCanvas(750,750);
const ctx = canvas.getContext('2d');

mongoose.connect(dbURI).then((result)=>{
    console.log('connected to db');
    CanvasImage.findOne({
        id: '1'
    })
    .then((result) => {
        if(!result){
            console.log("No image in the database");
            return;
        }
        console.log("retrieved image from database");
        const base64Image = result["base64Image"]
        const img = new Image;
        img.src = base64Image;
        ctx?.drawImage(img, 0, 0);
        setUpServer();
    })
    .catch((err)=>{
        console.log(err);
    })
}).catch((err) => {
    console.log(err);
})

function setUpServer() {
    amqp.connect('amqps://zqbfhloc:pOm_T3J-SMNSvruZvGi_DjtFZQvNk2dQ@codfish.rmq.cloudamqp.com/zqbfhloc', (err: any, connection: { createChannel: (arg0: (err: any, channel: any) => void) => void; close: () => void }) => {
        if(err){
            throw err;
        }

        connection.createChannel((err, channel) => {
            if(err){
                throw err;
            }

            io.on('connection', (socket) => {
                console.log('connection')
            
                socket.on('client-ready', ()=>{
                    var base64img = canvas.toDataURL("image/png");
                    socket.emit('server-ready', base64img);
                })
        
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
            
                // socket.on('canvas-state', (state) => {
                //     socket.broadcast.emit('canvas-state-from-server', state)
                // })
            
                socket.on('clear', ()=> io.emit('clear'))
            })
        })
    });
    
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
    // const buffer = canvas.toBuffer("image/png");
    // fs.writeFileSync("./image.png", buffer);
    const base64Image = canvas.toDataURL("image/png");
    CanvasImage.updateOne({ 
        id: '1'
    }, {
        $set: {base64Image: base64Image},
    },{
        upsert: true,
    })
    .then((result)=>{
        console.log("Image Saved on database");
    })
    .catch((err)=>{
        console.log(err);
    })
}