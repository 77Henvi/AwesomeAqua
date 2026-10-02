import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTINENTS,
  CONTINENT_META,
  normalizeContinent,
  filterFishByContinent,
  countSpeciesByContinent,
  formatContinentName
} from '../scripts/shared/continents.js';

test('CONTINENTS contains the 6 canonical continents', () => {
  assert.deepEqual(CONTINENTS, [
    'Africa',
    'Asia',
    'Europe',
    'North America',
    'South America',
    'Oceania'
  ]);
  assert.equal(Object.keys(CONTINENT_META).length, 6);
});

test('normalizeContinent parses exact and case-insensitive names', () => {
  assert.equal(normalizeContinent('South America'), 'South America');
  assert.equal(normalizeContinent('south america'), 'South America');
  assert.equal(normalizeContinent('SOUTH AMERICA'), 'South America');
  assert.equal(normalizeContinent('south-america'), 'South America');
  assert.equal(normalizeContinent('อเมริกาใต้'), 'South America');
  assert.equal(normalizeContinent('africa'), 'Africa');
  assert.equal(normalizeContinent('Asia'), 'Asia');
  assert.equal(normalizeContinent('europe'), 'Europe');
  assert.equal(normalizeContinent('North America'), 'North America');
  assert.equal(normalizeContinent('oceania'), 'Oceania');
  assert.equal(normalizeContinent('australia'), 'Oceania');
});

test('normalizeContinent returns null on invalid or empty input', () => {
  assert.equal(normalizeContinent(''), null);
  assert.equal(normalizeContinent(null), null);
  assert.equal(normalizeContinent(undefined), null);
  assert.equal(normalizeContinent('Atlantis'), null);
  assert.equal(normalizeContinent('RandomPlace'), null);
});

test('countSpeciesByContinent counts unique public species, ignoring stock count and archived', () => {
  const sampleFish = [
    { id: '1', name_th: 'ปอมปาดัวร์', continent: 'South America', stock: 20 },
    { id: '2', name_th: 'เทวดาอัลตั้ม', continent: 'South America', stock: 5 },
    { id: '3', name_th: 'ปลาหมอมาลาวี', continent: 'Africa', stock: 50 },
    { id: '4', name_th: 'ปลากัดป่า', continent: 'Asia', stock: 12 },
    { id: '5', name_th: 'ปลาไม่ระบุ', continent: null, stock: 10 },
    { id: '6', name_th: 'ปลาเลิกขาย', continent: 'South America', stock: 0, is_archived: true }
  ];

  const counts = countSpeciesByContinent(sampleFish);
  assert.equal(counts['South America'], 2); // 2 distinct active species
  assert.equal(counts['Africa'], 1);
  assert.equal(counts['Asia'], 1);
  assert.equal(counts['Europe'], 0);
  assert.equal(counts['North America'], 0);
  assert.equal(counts['Oceania'], 0);
});

test('filterFishByContinent filters species accurately and ignores archived', () => {
  const sampleFish = [
    { id: '1', name_th: 'ปอมปาดัวร์', continent: 'South America' },
    { id: '2', name_th: 'เทวดา', continent: 'south-america' },
    { id: '3', name_th: 'หมอสี', continent: 'Africa' },
    { id: '4', name_th: 'ปลาเก่า', continent: 'South America', is_archived: true }
  ];

  const saFish = filterFishByContinent(sampleFish, 'South America');
  assert.equal(saFish.length, 2);
  assert.equal(saFish[0].name_th, 'ปอมปาดัวร์');
  assert.equal(saFish[1].name_th, 'เทวดา');

  const afFish = filterFishByContinent(sampleFish, 'Africa');
  assert.equal(afFish.length, 1);
  assert.equal(afFish[0].name_th, 'หมอสี');

  const euFish = filterFishByContinent(sampleFish, 'Europe');
  assert.equal(euFish.length, 0);
});

test('formatContinentName formats localized display text', () => {
  assert.equal(formatContinentName('South America', false), 'อเมริกาใต้');
  assert.equal(formatContinentName('South America', true), 'South America');
  assert.equal(formatContinentName('Asia', false), 'เอเชีย');
  assert.equal(formatContinentName('Asia', true), 'Asia');
  assert.equal(formatContinentName('unknown', false), 'ไม่ระบุ');
  assert.equal(formatContinentName('unknown', true), 'Unknown');
});
