import express from 'express';
import http from 'http';
import amqp from 'amqplib/callback_api';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { drawLine } from './drawLine';
import { Canvas, CanvasRenderingContext2D, Image, createCanvas, loadImage } from 'canvas';
import fs from "fs";
import CanvasImage from "./canvasImages";
import { send } from 'process';

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
var canvas = createCanvas(900,750);
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
        img.onload = () => {
            ctx?.drawImage(img, 0, 0);
        }
        img.src = base64Image;
        setUpServer();
    })
    .catch((err)=>{
        console.log(err);
    })
}).catch((err) => {
    console.log(err);
})

function setUpServer() {

    io.on('connection', (socket) => {
        console.log('connection')
    
        socket.on('client-ready', ()=>{
            var base64img = canvas.toDataURL("image/png");
            socket.emit('server-ready', base64img);
        })

        socket.on('draw-line', (line) => {
            var { prevPoint, currentPoint, color } = line;
            drawLine({prevPoint, currentPoint, color, ctx})
            socket.broadcast.emit('draw-line', line);
        })
    
        socket.on('clear', ()=> io.emit('clear'))
    })

    // amqp.connect('amqps://yfnqrvwf:h2bNZfx95DfuQbePLX4vjFUeTO9i2Hwc@codfish.rmq.cloudamqp.com/yfnqrvwf', (err: any, connection: { createChannel: (arg0: (err: any, channel: any) => void) => void; close: () => void }) => {
    //     if(err){
    //         throw err;
    //     }

    //     connection.createChannel((err, channel) => {
    //         if(err){
    //             throw err;
    //         }

    //         io.on('connection', (socket) => {
    //             console.log('connection')
            
    //             socket.on('client-ready', ()=>{
    //                 var base64img = canvas.toDataURL("image/png");
    //                 socket.emit('server-ready', base64img);
    //             })
    
    //             socket.on('draw-line', (queue) => {
    //                 sendStrokesToQueue(queue, channel);
    //             })
            
    //             socket.on('clear', ()=> io.emit('clear'))
    //         })
    //     })

    // });
    
    // amqp.connect('amqps://yfnqrvwf:h2bNZfx95DfuQbePLX4vjFUeTO9i2Hwc@codfish.rmq.cloudamqp.com/yfnqrvwf', (err: any, connection: { createChannel: (arg0: (err: any, channel: any) => void) => void; close: () => void }) => {
    //     if(err){
    //         throw err;
    //     }
    
    //     connection.createChannel((err, channel) => {
    //         if(err){
    //             throw err;
    //         }
    //         let queueName = "strokesQueue";
    //         channel.assertQueue(queueName, {
    //             durable: false,
    //         });
    //         channel.consume(queueName, (msg: { content: { toString: () => any } }) => {
    //             try {
    //                 drawStrokesToCanvas(msg, ctx)
    //             } catch (e) {
    //                 console.error(e);
    //             }
    //         }, {
    //             noAck: true,
    //         })
    //     })
    // });
    
    server.listen(3001, () => {
        console.log('Server listening on port 3001')
    })

    setInterval(saveImage, 10000)
}

function drawStrokeToCanvas(strokeMsg: { content: any; }, ctx: CanvasRenderingContext2D, drawLine: { ({ prevPoint, currentPoint, ctx, color }: any): void; (arg0: { prevPoint: any; currentPoint: any; ctx: any; color: any; }): void; }){
    var {prevPoint, currentPoint, color} = JSON.parse(strokeMsg.content.toString());
    if(!ctx)return
    drawLine({prevPoint, currentPoint, ctx, color});
}

function drawImageToCanvas(base64Image: any, ctx: CanvasRenderingContext2D){
    var base64ImageString = JSON.parse(base64Image.content.toString())
    const img = new Image;
    img.onload = () => {
        ctx?.drawImage(img, 0, 0);
    }
    img.src = base64ImageString;
}

function drawStrokesToCanvas(strokes: any, ctx: CanvasRenderingContext2D){
    var strokesQueue = JSON.parse(JSON.parse(strokes.content.toString()))
    for (let i = 0; i < strokesQueue.length; i++) {
        var prevPoint = strokesQueue[i].prevPoint;
        var currentPoint = strokesQueue[i].currentPoint;
        var color = strokesQueue[i].color;
        drawLine({prevPoint, currentPoint, color, ctx})
    }
}

const sendLineToQueue = ({prevPoint, currentPoint, color}: DrawLine, channel:any) => {
    let queueName = "drawQueue";
    let line = {prevPoint, currentPoint, color};
    channel.assertQueue(queueName, {
        durable: false,
    });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(line)));
}

const sendImageToQueue = (base64Image: any, channel:any) => {
    let queueName = "drawQueue";
    channel.assertQueue(queueName, {
        durable: false,
    });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(base64Image)));
}

const sendStrokesToQueue = (queue:any, channel:any) => {
    let queueName = "strokesQueue";
    console.log(queue);
    channel.assertQueue(queueName, {
        durable: false,
    });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(queue)));
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