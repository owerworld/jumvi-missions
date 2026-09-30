import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('parent print books bind all 36 canonical records and approved presentation; PDF bytes are exact',()=>{
 const m=JSON.parse(read('assets/parents/mission-book-manifest.json')),catalog=JSON.parse(read('content/catalog.json'));
 assert.equal(Object.keys(m.missions).length,36);assert.equal(m.presentationSHA256,hash(read('content/customer-presentation-v1.json')));
 for(const record of catalog.missions){assert.equal(m.missions[record.id],record.sha256);assert.equal(m.missions[record.id],hash(read(`content/missions/${record.id}.json`)));}
 for(const locale of ['tr','en-US']){const book=m.books[locale],bytes=read(book.path);assert.equal(hash(bytes),book.sha256);assert.equal(bytes.length,book.bytes);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');}
});
test('parent PDFs are packaged as optional resources, outside critical mission precache',()=>{
 for(const dir of ['dist','dist-v2/v2']){const release=JSON.parse(read(`${dir}/release-manifest.json`)),sw=JSON.parse(read(`${dir}/sw-release.json`));assert.equal(release.files.filter(f=>f.path.endsWith('.pdf')&&f.path.includes('/assets/parents/')).length,2);assert.ok(!sw.precache.some(p=>p.includes('/assets/parents/')));for(const paths of Object.values(sw.missions))assert.ok(!paths.some(p=>p.includes('/assets/parents/')));}
});
