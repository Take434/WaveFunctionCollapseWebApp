import * as fs from 'fs';
import * as png from 'fast-png';
import { IOBuffer } from 'iobuffer';
import type { DecodedPng, PngDataArray } from 'fast-png';
import Stack from 'ts-data.stack';

export type jsonRules = 
    {
        Path : string,
        Weight : number, 
        Rules : number[][]
    }[]


class MyDecodedPng implements DecodedPng {
    width: number;
    height: number;
    data: png.PngDataArray;
    depth: png.BitDepth;
    channels: number;
    text: { [key: string]: string; };
    resolution?: png.PngResolution | undefined;
    palette?: png.IndexedColors | undefined;
    iccEmbeddedProfile?: png.IccEmbeddedProfile | undefined;

    constructor(w : number, h : number, data : png.PngDataArray, depth: png.BitDepth, channels: number, text? : { [key: string]: string }) {
        this.width = w;
        this.height = h;
        this.channels = channels;
        this.data = data;
        this.depth = depth;
        this.text = text ?? {};
    }

}

export class WfcModel {

    private lookUp : String[];
    private weightings : number[];
    private ruleset : number[][][];
    private outputDims : [number, number];

    private output : boolean[][][] = [[[]]];
    private entropyMap : number[][] = [[]];

    public isCollapsed : boolean = false;
    public isContradicted : boolean = false;

    constructor(ruleset : jsonRules, outputDims : [number, number]) {
        let jsonData : jsonRules = ruleset;

        console.log(jsonData);

        this.lookUp = jsonData.map(e => e.Path);
        this.weightings = jsonData.map(e => e.Weight);
        this.ruleset = jsonData.map(e => e.Rules);
        this.outputDims = outputDims;

        this.initializeOutput();
    }

    public collapse() {
        while(!this.isCollapsed && !this.isContradicted) {
            const nextField : [number, number] = this.chooseNextField();

            this.placeTile(nextField);

            this.propagateChanges(nextField);

            this.isCollapsed = this.checkCollapsed();
            this.isContradicted = this.checkContradicted();
        }

        if(this.isContradicted) {
            console.error("reached Contradiction");
        }
    }

    public reCollapse() {
        this.initializeOutput();
        this.collapse();
    }

    public async getResultAsEncodedPNG() : Promise<png.PngDataArray | null> {

        if(this.isContradicted) {
            return null;
        }

        const tileImages : DecodedPng[] = [];

        for(let p of this.lookUp) {
            tileImages.push(png.decode(await this.getImgAsIOBuffer('' + p)));
        }

        const outputTileArrangement : DecodedPng[][] = new Array<Array<DecodedPng>>(this.output.length);
        for(let i = 0; i < outputTileArrangement.length; i++) {
            outputTileArrangement[i] = new Array<DecodedPng>(this.output[i].length);
        }

        for(let i = 0; i < this.output.length; i++) {
            for(let j = 0; j < this.output[i].length; j++) {
                for(let k = 0; k < this.output[i][j].length; k++) {
                    if(this.output[i][j][k]) {
                        outputTileArrangement[i][j] = tileImages[k];
                        break;
                    }
                }
            }
        }

        let outputImageArray : number[] = [];
        const height : number = tileImages[0].height;
        
        for(let e of outputTileArrangement) {
            for(let i = 0; i < height; i++) {
                for(let j = 0; j < e.length; j++) {
                    e[j].data.subarray(i * height * 3, (i + 1) * height * 3).forEach(e => {
                        outputImageArray.push(e);
                    })
                }
            }
        }

        let a = new Uint16Array(outputImageArray);
        const img : MyDecodedPng = new MyDecodedPng(height * this.outputDims[1], height * this.outputDims[0], a , 8, 3);
        const encodedImg : PngDataArray = png.encode(img);

        return encodedImg;
    }

    public async saveResultAsFile(filePath : string) {

        this.getResultAsEncodedPNG().then(e => {

            if(e === null) {
                return;
            }

            fs.writeFileSync('' + filePath, e as PngDataArray);
        });
    }

    private getImgAsIOBuffer(filePath : string) : Promise<IOBuffer> {
        return new Promise((resolve, reject) => {
            let img = fs.createReadStream('' + filePath);
            let chunks : Buffer[] = [];

            img.on('data', (chunk) => {
                chunks.push(chunk as Buffer);
            });

            img.once('end', () => {
                resolve(new IOBuffer(Buffer.concat(chunks)));
            });

            img.once('error', (e) => {
                reject(e);
            })
        });
    }

    private initializeOutput() {
        this.output = new Array(this.outputDims[0]);
        for(let i = 0; i < this.outputDims[0]; i++) {
            this.output[i] = new Array(this.outputDims[1]);
            
            for(let j = 0; j < this.outputDims[1]; j++) {
                this.output[i][j] = new Array(this.lookUp.length);
                this.output[i][j] = this.output[i][j].fill(true);
            }
        }

        this.entropyMap = new Array(this.outputDims[0]);
        for(let i = 0; i < this.outputDims[0]; i++) {
            this.entropyMap[i] = new Array(this.outputDims[1]);
            this.entropyMap[i] = this.entropyMap[i].fill(this.lookUp.length);
        }
    }

    private chooseNextField() : [number, number] {
        let nextField : [number, number] = [0, 0];
        //let lowestEntropy : number = this.entropyMap[0][0];

        // for(let i = 0; i < this.entropyMap.length; i++) {
        //     for(let j = 0; j < this.entropyMap[i].length; j++) {
        //         if(lowestEntropy === 1 || (this.entropyMap[i][j] < lowestEntropy && this.entropyMap[i][j] !== 1)) {
        //             lowestEntropy = this.entropyMap[i][j];
        //             nextField = [i, j];
        //         }
        //     }
        // }

        const lowestEntropy : number = this.entropyMap.flat().sort().filter(v => v > 1)[0];
        const fieldsWithLowestEntropy : [number, number][] = [];
        
        for(let i = 0; i < this.entropyMap.length; i++) {
            for(let j = 0; j < this.entropyMap[i].length; j++) {
                if(this.entropyMap[i][j] === lowestEntropy) {
                    fieldsWithLowestEntropy.push([i, j]);
                }
            }
        }

        const rand : number = Math.floor(Math.random() * (fieldsWithLowestEntropy.length - 1));

        return fieldsWithLowestEntropy[rand];
    }

    private placeTile(field : [number, number]) {
        const fieldDomain : boolean[] = this.output[field[0]][field[1]];
        const fieldDomainWeights : number[] = [];

        for(let i = 0; i < fieldDomain.length; i++) {
            if(fieldDomain[i]) {
                fieldDomainWeights.push(this.weightings[i]);
            } else {
                fieldDomainWeights.push(0);
            }
        }

        const cumulatedWeights : number = fieldDomainWeights.reduce((partialSum, a) => partialSum += a);
        let randNum : number = Math.random() * cumulatedWeights;

        for(let i = 0; i < fieldDomainWeights.length; i++) {
            if(fieldDomainWeights[i] === 0) {
                continue;
            }

            if(fieldDomainWeights[i] >= randNum) {
                this.output[field[0]][field[1]].fill(false);
                this.output[field[0]][field[1]][i] = true;

                this.entropyMap[field[0]][field[1]] = 1;

                return;
            }

            randNum -= fieldDomainWeights[i];
        }
    }

    private propagateChanges(field : [number, number]) {
        let propagationStack : Stack<[number, number]> = new Stack<[number, number]>();

        this.pushNeighbours(field, propagationStack);

        while(!propagationStack.isEmpty()) {
            const fieldToPropagate : [number, number] = propagationStack.pop();

            let possibleTiles : number[] = new Array<number>(this.lookUp.length);
            for(let i = 0; i < possibleTiles.length; i++) {
                possibleTiles[i] = i;
            }


            //check ruleset for all possible tiles in field above
            if(this.isFieldOnOutput([fieldToPropagate[0] - 1, fieldToPropagate[1]])) {
                const indiciesForRules : number[] = this.output[fieldToPropagate[0] - 1][fieldToPropagate[1]].map((v, i) => {
                    if(v) {
                        return i;
                    }
                }) as number[];
                
                let possibleAdjacentTiles : number[] = [];
                for(let e of indiciesForRules.filter(e => e !== undefined)) {
                    possibleAdjacentTiles = possibleAdjacentTiles.concat(this.ruleset[e][2]);
                };

                possibleTiles = possibleTiles.filter(v => possibleAdjacentTiles.includes(v));
            }

            //check ruleset for all possible tiles in field to the right
            if(this.isFieldOnOutput([fieldToPropagate[0], fieldToPropagate[1] + 1])) {
                const indiciesForRules : number[] = this.output[fieldToPropagate[0]][fieldToPropagate[1] + 1].map((v, i) => {
                    if(v) {
                        return i;
                    }
                }) as number[];

                let possibleAdjacentTiles : number[] = [];
                for(let e of indiciesForRules.filter(e => e !== undefined)) {
                    possibleAdjacentTiles = possibleAdjacentTiles.concat(this.ruleset[e][3]);
                };

                possibleTiles = possibleTiles.filter(v => possibleAdjacentTiles.includes(v));
            }

            //check ruleset for all possible tiles in field below
            if(this.isFieldOnOutput([fieldToPropagate[0] + 1, fieldToPropagate[1]])) {
                const indiciesForRules : number[] = this.output[fieldToPropagate[0] + 1][fieldToPropagate[1]].map((v, i) => {
                    if(v) {
                        return i;
                    }
                }) as number[];

                let possibleAdjacentTiles : number[] = [];
                for(let e of indiciesForRules.filter(e => e !== undefined)) {
                    possibleAdjacentTiles = possibleAdjacentTiles.concat(this.ruleset[e][0]);
                };

                possibleTiles = possibleTiles.filter(v => possibleAdjacentTiles.includes(v));
            }

            //check ruleset for all possible tiles in field to the left
            if(this.isFieldOnOutput([fieldToPropagate[0], fieldToPropagate[1] - 1])) {
                const indiciesForRules : number[] = this.output[fieldToPropagate[0]][fieldToPropagate[1] - 1].map((v, i) => {
                    if(v) {
                        return i;
                    }
                }) as number[];

                let possibleAdjacentTiles : number[] = [];
                for(let e of indiciesForRules.filter(e => e !== undefined)) {
                    possibleAdjacentTiles = possibleAdjacentTiles.concat(this.ruleset[e][1]);
                };

                possibleTiles = possibleTiles.filter(v => possibleAdjacentTiles.includes(v));
            }

            let changed : boolean = false;
            for(let i = 0; i < this.output[fieldToPropagate[0]][fieldToPropagate[1]].length; i++) {
                if(!possibleTiles.includes(i) && this.output[fieldToPropagate[0]][fieldToPropagate[1]][i]) {
                    this.output[fieldToPropagate[0]][fieldToPropagate[1]][i] = false;
                    this.entropyMap[fieldToPropagate[0]][fieldToPropagate[1]] -= 1; 
                    changed = true;
                }
            }

            if(changed) {
                this.pushNeighbours(fieldToPropagate, propagationStack);
            }
        }
    }

    private pushNeighbours(field : [number, number], propagationStack : Stack<[number, number]>) {
        if(this.isFieldOnOutput([field[0] - 1, field[1]]) && this.entropyMap[field[0] - 1][field[1]] > 1) {
            propagationStack.push([field[0] - 1, field[1]]);
        }
        if(this.isFieldOnOutput([field[0], field[1] + 1]) && this.entropyMap[field[0]][field[1] + 1] > 1) {
            propagationStack.push([field[0], field[1] + 1]);
        }
        if(this.isFieldOnOutput([field[0] + 1, field[1]]) && this.entropyMap[field[0] + 1][field[1]] > 1) {
            propagationStack.push([field[0] + 1, field[1]]);
        }
        if(this.isFieldOnOutput([field[0] , field[1] - 1]) && this.entropyMap[field[0]][field[1] - 1] > 1) {
            propagationStack.push([field[0] , field[1] - 1]);
        }
    }

    private isFieldOnOutput(field : [number, number]) : boolean {

        if(field[0] < 0 || field[1] < 0) {
            return false;
        }

        return field[0] < this.output.length && field[1] < this.output[field[0]].length;
    }

    private checkCollapsed() : boolean {
        for(let e of this.entropyMap) {
            for(let a of e) {
                if(a > 1) {
                    return false;
                }
            }
        }

        return true;
    }

    private checkContradicted() : boolean {
        for(let e of this.entropyMap) {
            for(let a of e) {
                if(a < 1) {
                    return true;
                }
            }
        }

        return false;
    }
}