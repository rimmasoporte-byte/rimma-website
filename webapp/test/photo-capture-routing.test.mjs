import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPhotoCapturePage,
  parsePhotoCaptureApiPath
} from '../photo-capture-route.mjs';

const compact='3.5f31c5e0468f4a3488e0f0da4620d92a.muv2gw8m.cy8VUAwFdyS2kOEUOjeqdg';
const legacy='eyJ2IjoyLCJraW5kIjoiZHJhZnQifQ.2lTh-uSitxGmc0jS-uxJAucAOdhYgRP_y2X_-9LqrzM';

test('compact v3 draft capture route is accepted',()=>{
  assert.equal(isPhotoCapturePage('/capture/'+compact),true);
  assert.deepEqual(parsePhotoCaptureApiPath('/api/photo-capture/'+compact),{
    token:compact,upload:false
  });
  assert.deepEqual(parsePhotoCaptureApiPath('/api/photo-capture/'+compact+'/upload'),{
    token:compact,upload:true
  });
});

test('legacy signed capture route stays backward compatible',()=>{
  assert.equal(isPhotoCapturePage('/capture/'+legacy),true);
  assert.deepEqual(parsePhotoCaptureApiPath('/api/photo-capture/'+legacy),{
    token:legacy,upload:false
  });
});

test('malformed capture paths are rejected',()=>{
  assert.equal(isPhotoCapturePage('/capture/3.bad'),false);
  assert.equal(parsePhotoCaptureApiPath('/api/photo-capture/../../etc/passwd'),null);
  assert.equal(parsePhotoCaptureApiPath('/api/photo-capture/'+compact+'/other'),null);
});
