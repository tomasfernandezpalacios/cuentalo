import { base64ToBytes } from '../base64';

describe('base64ToBytes', () => {
  it('decodifica a bytes', () => {
    expect(Array.from(base64ToBytes('SG9sYQ=='))).toEqual([72, 111, 108, 97]); // "Hola"
    expect(base64ToBytes('')).toHaveLength(0);
  });
});
