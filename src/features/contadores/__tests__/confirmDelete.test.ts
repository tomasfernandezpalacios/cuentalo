import { removeFromHomeMessage } from '../confirmDelete';

describe('removeFromHomeMessage', () => {
  it('explica que no eres el admin, que sigues perteneciendo y que se puede deshacer', () => {
    const text = removeFromHomeMessage([{ name: 'Cafés' }]);
    expect(text).toContain('No puedes eliminar «Cafés» porque no eres su administrador');
    expect(text).toContain('seguirás perteneciendo a él');
    expect(text).toContain('Se puede deshacer');
  });

  it('usa el plural con varios contadores', () => {
    const text = removeFromHomeMessage([{ name: 'A' }, { name: 'B' }]);
    expect(text).toContain('«A», «B»');
    expect(text).toContain('quitarlos');
  });
});
