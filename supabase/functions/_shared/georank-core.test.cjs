const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require(path.resolve(__dirname,'../../../apps/portal/node_modules/typescript'));
const source=fs.readFileSync(path.join(__dirname,'georank-core.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const compiledModule={exports:{}};
vm.runInNewContext(js,{module:compiledModule,exports:compiledModule.exports,Math,Number,Error},{filename:'georank-core.ts'});
const geo=compiledModule.exports;

test('square grid is centered, deterministic, and uses meter offsets',()=>{
  const points=geo.createGeoGrid({latitude:31.5,longitude:74.3},3,100);
  assert.equal(points.length,9);
  assert.equal(points[4].row,1);assert.equal(points[4].column,1);
  assert.ok(Math.abs(points[4].latitude-31.5)<1e-9);
  assert.ok(Math.abs(points[4].longitude-74.3)<1e-9);
  assert.ok(points[0].latitude>points[6].latitude);
  assert.ok(points[2].longitude>points[0].longitude);
  assert.deepEqual(Array.from(points,p=>p.index),[0,1,2,3,4,5,6,7,8]);
});

test('grid validates coordinates, odd dimensions, spacing, and point cap',()=>{
  assert.throws(()=>geo.createGeoGrid({latitude:91,longitude:0},3,100),/INVALID_CENTER_COORDINATES/);
  assert.throws(()=>geo.createGeoGrid({latitude:0,longitude:0},2,100),/INVALID_GRID_SIZE/);
  assert.throws(()=>geo.createGeoGrid({latitude:0,longitude:0},5,100,24),/INVALID_GRID_SIZE/);
  assert.throws(()=>geo.createGeoGrid({latitude:0,longitude:0},3,0),/INVALID_GRID_SPACING/);
});

test('longitude wraps cleanly when a grid crosses the antimeridian',()=>{
  const points=geo.createGeoGrid({latitude:0,longitude:179.9999},3,100);
  assert.ok(points.every(p=>p.longitude>=-180 && p.longitude<=180));
  assert.ok(points.some(p=>p.longitude<0));
});

test('failed and pending points are not treated as rank zero or valid observations',()=>{
  const metrics=geo.calculateGeoScanMetrics([
    {status:'found',rank:2},
    {status:'not_found_within_depth',rank:null},
    {status:'failed',rank:null},
    {status:'pending',rank:null},
    {status:'cancelled',rank:null},
  ],20);
  assert.equal(metrics.planned_points,5);
  assert.equal(metrics.valid_points,2);
  assert.equal(metrics.completion_percent,40);
  assert.equal(metrics.top_3_coverage_percent,50);
  assert.equal(metrics.top_10_coverage_percent,50);
  assert.equal(metrics.mean_observed_rank,2);
  assert.equal(metrics.has_survivorship_bias,true);
});

test('metrics omit rank summaries when observations are not valid',()=>{
  const metrics=geo.calculateGeoScanMetrics([{status:'failed',rank:null},{status:'pending',rank:null}],10);
  assert.equal(metrics.completion_percent,0);
  assert.equal(metrics.top_3_coverage_percent,null);
  assert.equal(metrics.mean_observed_rank,null);
  assert.equal(metrics.has_survivorship_bias,false);
});

test('invalid rank/status combinations are rejected',()=>{
  assert.throws(()=>geo.calculateGeoScanMetrics([{status:'found',rank:0}],10),/INVALID_FOUND_RANK/);
  assert.throws(()=>geo.calculateGeoScanMetrics([{status:'failed',rank:3}],10),/RANK_REQUIRES_FOUND_STATUS/);
  assert.throws(()=>geo.calculateGeoScanMetrics([{status:'found',rank:11}],10),/INVALID_FOUND_RANK/);
});

test('cost estimate uses configured provider units and blocks over-budget scans',()=>{
  const estimate=geo.estimateGeoScanCost(3,2,150,{
    cost_per_billable_unit_usd:0.002,results_per_billable_unit:100,max_depth:700,max_points:225,
  },0.05);
  assert.equal(estimate.request_count,18);
  assert.equal(estimate.billable_units,36);
  assert.equal(estimate.estimated_cost_usd,0.072);
  assert.equal(estimate.within_budget,false);
  const covered=geo.estimateGeoScanCost(3,1,100,{
    cost_per_billable_unit_usd:0.002,results_per_billable_unit:100,max_depth:700,max_points:225,
  },0.02);
  assert.equal(covered.within_budget,true);
  assert.throws(()=>geo.estimateGeoScanCost(5,1,100,{
    cost_per_billable_unit_usd:0.002,results_per_billable_unit:100,max_depth:700,max_points:24,
  },1),/INVALID_COST_ESTIMATE_INPUT/);
});
