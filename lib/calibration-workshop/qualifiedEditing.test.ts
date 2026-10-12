import test from "node:test";
import assert from "node:assert/strict";
import { applyWorkingEdit, createWorkingCalibration, redoWorkingEdit, undoWorkingEdit, workingCellValue, workingChangedDefinitionKeys, type WorkingDefinitionSeed, type WorkingEditOperation } from "./workingCalibration.ts";
import { integerBytes, matrixEditTargets, parseWorkingMatrix, parseWorkingNumber, planWorkingToolbar, selectedRectangle } from "./qualifiedEditing.ts";
import { replayDurableWorking } from "./durableWorking.ts";
import { classifyCalibrationEditCapability } from "./editAuthority.ts";
import { assessDefinitionExtractionCapability } from "../xdf/calibrationValueExtraction.ts";
import type { XdfDefinitionRevision } from "../xdf/canonicalXdfDefinition.ts";

const stamp = "2026-10-12T00:00:00.000Z";
function fixture(rows=3,columns=3,signed=false,widthBits:8|16|32=16,endianness:"little"|"big"="little",scale=0.5,offset=10) {
  const definition: WorkingDefinitionSeed = { definitionRevision:"definition",occurrence:2,rows,columns,availability:"available",storage:{widthBits,signed,endianness},
    capability:{state:"EDIT_QUALIFIED",revision:"edit",inverse:{scale,offset,rawMinimum:signed ? -(2**(widthBits-1)) : 0,rawMaximum:signed ? 2**(widthBits-1)-1 : 2**widthBits-1},engineeringMinimum:null,engineeringMaximum:null,warnings:["No qualified safety envelope"],blockers:[]},
    cells:Array.from({length:rows*columns},(_,index)=>({definitionRevision:"definition",occurrence:2,index,row:Math.floor(index/columns),column:index%columns,
      currentValue:index*scale+offset,currentRawValue:index,currentRawOffset:8+index*widthBits/8,units:"u"})) };
  const working=createWorkingCalibration({ownerScope:"owner",vehicleId:"synthetic",currentDatasetId:"current",currentDatasetRevision:"revision",romLayoutId:"layout",relationshipRevision:"relation",definitionSetRevision:"defs",createdAt:stamp});
  const address=(index:number)=>{ const {definitionRevision,occurrence,row,column}=definition.cells[index]; return {definitionRevision,occurrence,index,row,column}; };
  return {definition,working,address};
}
function applied(result:ReturnType<typeof applyWorkingEdit>) { assert.equal(result.status,"applied",result.status==="blocked"?result.findings.join(" "):""); return result.calibration; }
function edit(f:ReturnType<typeof fixture>,operation:WorkingEditOperation,operand:number,indices=[0],working=f.working) {
  return applied(applyWorkingEdit(working,{operation,operand,targets:indices.map(f.address),definitions:[f.definition],recordExactRaw:true,updatedAt:stamp}));
}
for(const text of ["", " ", "NaN", "Infinity", "-Infinity", "0x20", "1,25", "1_000", "1 000", "=1+2", "1e999", "1e-999", "--1", "1.2.3", "1".repeat(65)])
  test(`decimal input rejects ${JSON.stringify(text)}`,()=>assert.throws(()=>parseWorkingNumber(text)));
test("decimal point, sign and explicit scientific notation parse deterministically",()=>{
  for(const [text,value] of [["-1.25",-1.25],["+.5",.5],["1e2",100],[" 12.5 ",12.5]] as const) assert.equal(parseWorkingNumber(text),value);
});
for(const width of [8,16,32] as const) for(const signed of [false,true]) for(const endian of ["little","big"] as const)
  test(`exact ${width}-bit ${signed?"signed":"unsigned"} ${endian} round trip and untouched bytes`,()=>{
    const f=fixture(1,3,signed,width,endian),raw=signed?-2:2, target=raw*.5+10;
    const changed=edit(f,"assign",target,[1]), mutation=changed.mutations[0],trace=mutation.exactRaw![0];
    const original=new Uint8Array(32).fill(0xA5), output=original.slice(); output.set(trace.afterBytes,trace.offset);
    assert.deepEqual(trace.afterBytes,integerBytes(raw,{widthBits:width,signed,endianness:endian}));
    const view=new DataView(output.buffer),read=width===8 ? signed?view.getInt8(trace.offset):view.getUint8(trace.offset) : width===16 ? signed?view.getInt16(trace.offset,endian==="little"):view.getUint16(trace.offset,endian==="little") : signed?view.getInt32(trace.offset,endian==="little"):view.getUint32(trace.offset,endian==="little");
    assert.equal(read,raw); assert.equal(mutation.after[0],read*.5+10);
    for(let i=0;i<output.length;i++) if(i<trace.offset||i>=trace.offset+width/8) assert.equal(output[i],original[i]);
    assert.equal(f.definition.cells[1].currentRawValue,1); assert.equal(f.working.cursor,0);
    assert.deepEqual(replayDurableWorking(changed,f.working,()=>f.definition),changed);
  });
test("explicit rounding only tolerates floating arithmetic error and rejects other fractions or range overflow",()=>{
  const f=fixture(); const good=edit(f,"assign",11+1e-9); assert.equal(good.mutations[0].after[0],11);
  assert.equal(good.mutations[0].exactRaw![0].rounding,"nearest-integer-within-1e-7-otherwise-reject");
  for(const value of [10.1,Infinity,NaN,1e30,-1]) assert.equal(applyWorkingEdit(f.working,{operation:"assign",operand:value,targets:[f.address(0)],definitions:[f.definition],recordExactRaw:true,updatedAt:stamp}).status,"blocked");
});
test("add, subtract, multiply and percentage changes preserve selected-cell scope",()=>{
  const f=fixture(4,4); for(const [operation,operand,value] of [["delta",1,11],["delta",-1,9],["multiply",2,20],["percentage",10,11],["percentage",-10,9]] as const) {
    const signed={...f,definition:{...f.definition,capability:{...f.definition.capability,inverse:{...f.definition.capability.inverse!,rawMinimum:-100}} ,storage:{...f.definition.storage!,signed:true}}};
    const changed=edit(signed,operation,operand,[0,10]); assert.equal(workingCellValue(changed,f.address(0)),value); assert.equal(workingCellValue(changed,f.address(1),10.5),10.5);
  }
});
test("bounded rectangular matrix preserves row-major placement after canonical mutation ordering",()=>{
  const f=fixture(4,4), input=matrixEditTargets(f.definition,[f.address(0)],parseWorkingMatrix("10\t11\t12\n13\t14\t15\n16\t17\t18"));
  const w=applied(applyWorkingEdit(f.working,{...input,operation:"matrix",operand:0,recordExactRaw:true,definitions:[f.definition],updatedAt:stamp}));
  assert.equal(workingCellValue(w,f.address(10)),18); assert.equal(workingCellValue(w,f.address(3),11.5),11.5);
  assert.deepEqual(replayDurableWorking(w,f.working,()=>f.definition),w);
});
test("malformed, jagged, oversized, blank and formula clipboard input is rejected atomically",()=>{
  for(const text of ["1\t2\n3", "1\t", "\n", "=SUM(A1)\t2", "1\n".repeat(4097),"1".repeat(131073)]) assert.throws(()=>parseWorkingMatrix(text));
  const f=fixture(); assert.throws(()=>matrixEditTargets(f.definition,[f.address(8)],[[1,2]]));
  assert.throws(()=>matrixEditTargets(f.definition,[f.address(0),f.address(1)],[[1],[2]]));
  assert.throws(()=>selectedRectangle([f.address(0),f.address(4)]));
  assert.throws(()=>selectedRectangle([f.address(0),{...f.address(1),occurrence:9}]));
});
test("structural interpolation uses pre-edit endpoints, preserves occurrence and rejects unavailable geometry",()=>{
  const f=fixture(); let w=edit(f,"assign",10,[0,3,6]); w=edit(f,"assign",20,[2,5,8],w);
  w=edit(f,"interpolate-horizontal",0,[0,1,2,3,4,5,6,7,8],w);
  assert.equal(workingCellValue(w,f.address(1)),15);
  w=edit(f,"assign",14,[6],w); w=edit(f,"interpolate-vertical",0,[0,3,6],w); assert.equal(workingCellValue(w,f.address(3)),12);
  assert.equal(workingCellValue(w,{...f.address(0),occurrence:3},70),70);
  assert.equal(applyWorkingEdit(w,{operation:"interpolate-horizontal",operand:0,targets:[f.address(0)],definitions:[f.definition],recordExactRaw:true,updatedAt:stamp}).status,"blocked");
});
test("revert selected or complete Table is undoable; redo and saved history continuation are exact",()=>{
  const f=fixture(),changed=edit(f,"assign",20,[0,1]),reverted=edit(f,"revert",0,[0,1],changed);
  assert.equal(workingCellValue(reverted,f.address(0)),10);
  assert.deepEqual(workingChangedDefinitionKeys(reverted),[]);
  assert.deepEqual(workingChangedDefinitionKeys(changed),["definition:2"]);
  const undo=undoWorkingEdit(reverted,stamp);assert.equal(workingCellValue(undo,f.address(0)),20);
  assert.deepEqual(redoWorkingEdit(undo,stamp),reverted);
  const restored=replayDurableWorking(undo,f.working,()=>f.definition),continued=edit(f,"delta",1,[0],restored);
  assert.equal(continued.mutations.length,2);assert.equal(workingCellValue(continued,f.address(0)),21);
  assert.equal(redoWorkingEdit(continued,stamp),continued);
});
test("raw entry applies the owner conversion and rejects fractional or unrepresentable integers",()=>{
  const f=fixture(),w=edit(f,"raw",12);assert.equal(workingCellValue(w,f.address(0)),16);assert.equal(w.mutations[0].exactRaw![0].after,12);
  for(const raw of [1.5,-1,65536]) assert.equal(applyWorkingEdit(f.working,{operation:"raw",operand:raw,targets:[f.address(0)],definitions:[f.definition],recordExactRaw:true,updatedAt:stamp}).status,"blocked");
  assert.deepEqual(replayDurableWorking(w,f.working,()=>f.definition),w);
});
test("tampering with raw bytes, offsets, matrix values or rounding cannot survive server replay",()=>{
  const f=fixture(),w=edit(f,"assign",20);
  for(const field of ["offset","after","afterBytes","rounding"]) {
    const value=JSON.parse(JSON.stringify(w));value.mutations[0].exactRaw[0][field]=field==="afterBytes"?[255,255]:field==="rounding"?"clamp":999;
    assert.throws(()=>replayDurableWorking(value,f.working,()=>f.definition));
  }
});
test("unqualified raw storage, overlapping cells, quarantine and absent exact occurrences stay blocked",()=>{
  const f=fixture(); const cases:WorkingDefinitionSeed[]=[{...f.definition,storage:undefined},{...f.definition,availability:"quarantined"},
    {...f.definition,availability:"unavailable"},{...f.definition,capability:{...f.definition.capability,state:"VIEW_ONLY"}},
    {...f.definition,cells:f.definition.cells.map(c=>({...c,currentRawOffset:8}))},
    {...f.definition,capability:{...f.definition.capability,inverse:null}},
    {...f.definition,storage:{...f.definition.storage!,widthBits:64 as 32}}];
  for(const definition of cases) assert.equal(applyWorkingEdit(f.working,{operation:"assign",operand:20,targets:[f.address(0),f.address(1)],definitions:[definition],recordExactRaw:true,updatedAt:stamp}).status,"blocked");
});
test("toolbar only enables exact supported operations and deterministic input",()=>{
  const f=fixture(); assert.throws(()=>planWorkingToolbar("assign","0x20",[f.address(0)],f.definition));
  assert.equal(planWorkingToolbar("matrix","10\t11",[f.address(0)],f.definition).targets.length,2);
  assert.equal(planWorkingToolbar("revert","",[f.address(0)],f.definition).operand,0);
});
test("float, bit-width, masked expression and unknown byte order never acquire editing or extraction qualification",()=>{
  const definition:XdfDefinitionRevision={identity:{status:"derived",stableId:"def",derivationBasis:"kind-primary-address-storage-layout",unresolvedReason:null},
    revisionId:"def",structuralDigest:"s",sourceArtifactDigest:"a",sourceBindingDigest:"b",definitionKind:"table",title:null,description:null,primaryAddress:0,
    addressSpace:{baseOffset:0,subtractBaseOffset:false,regions:[]},defaultDataLayout:{elementSizeBits:16,signed:false,floatingPoint:false,outputType:null},
    byteOrderMetadata:{lsbFirst:true,source:"explicit"},qualificationState:"structurally_interpreted",axes:[{axisId:"z",indexCount:1,dataType:"0",dataTypeMetadata:{kind:"integer",resolution:"explicit",sourceValue:"0"},
      representation:"address_backed",literalLabels:[],units:null,embeddedData:{address:0,addressSource:"0",elementSizeBits:16,rowCount:1,columnCount:1,majorStrideBits:0,minorStrideBits:0,typeFlags:null},equationSource:"X",equationVariables:["X"]}]};
  const classify=(d:XdfDefinitionRevision)=>classifyCalibrationEditCapability({definition:d,occurrence:0,relationshipRevision:"r",definitionSetRevision:"set",definitionSetDefinitionRevisions:["def"]});
  assert.equal(classify({...definition,defaultDataLayout:{...definition.defaultDataLayout,floatingPoint:true}}).state,"EDIT_BLOCKED_REPRESENTATION");
  assert.equal(classify({...definition,axes:definition.axes.map(a=>({...a,embeddedData:{...a.embeddedData,elementSizeBits:1}}))}).state,"EDIT_BLOCKED_REPRESENTATION");
  assert.equal(classify({...definition,axes:definition.axes.map(a=>({...a,equationSource:"X & 15"}))}).state,"EDIT_BLOCKED_NON_INVERTIBLE");
  assert.notEqual(assessDefinitionExtractionCapability({...definition,byteOrderMetadata:{lsbFirst:null,source:null}}).state,"extraction_capable");
});
test("a later edit cannot alias bytes already used by a different occurrence",()=>{
  const f=fixture(),first=edit(f,"assign",20),other={...f.definition,occurrence:3,cells:f.definition.cells.map(c=>({...c,occurrence:3}))};
  const result=applyWorkingEdit(first,{operation:"assign",operand:21,targets:[{...f.address(0),occurrence:3}],definitions:[other],recordExactRaw:true,updatedAt:stamp});
  assert.equal(result.status,"blocked");assert.equal(result.calibration,first);
});
test("unrepresentable interpolation rejects the whole operation without touching endpoints",()=>{
  const f=fixture(),first=edit(f,"assign",20,[2,5,8]);
  const result=applyWorkingEdit(first,{operation:"interpolate-horizontal",operand:0,targets:f.definition.cells.map((_,i)=>f.address(i)),definitions:[f.definition],recordExactRaw:true,updatedAt:stamp});
  assert.equal(result.status,"blocked");assert.equal(result.calibration,first);
});
test("new edit cannot create a revision exceeding the durable payload limit",()=>{
  const f=fixture(),definition={...f.definition,capability:{...f.definition.capability,warnings:["x".repeat(2*1024*1024)]}};
  const result=applyWorkingEdit(f.working,{operation:"assign",operand:20,targets:[f.address(0)],definitions:[definition],recordExactRaw:true,updatedAt:stamp});
  assert.equal(result.status,"blocked");assert.equal(result.calibration,f.working);
});
