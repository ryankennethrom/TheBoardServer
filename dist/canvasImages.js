import mongoose from "mongoose";
const Schema = mongoose.Schema;
const canvasImagesSchema = new Schema({
    id: {
        type: String,
        required: true,
    },
    base64Image: {
        type: String,
        required: true
    }
}, { timestamps: true });
const CanvasImage = mongoose.model('CanvasImages', canvasImagesSchema);
export default CanvasImage;
