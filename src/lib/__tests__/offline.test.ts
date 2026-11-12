import { sendAddEntry, sendRemoveOne } from '../offline';

const mockCreateEntry = jest.fn(async () => {});
const mockAddToCommonCounter = jest.fn(async () => {});
const mockRemoveOne = jest.fn(async () => true);
const mockRemoveOneFromCommonCounter = jest.fn(async () => {});

jest.mock('@/features/contadores/api', () => ({
  createEntry: (...args: unknown[]) => mockCreateEntry(...(args as [])),
  addToCommonCounter: (...args: unknown[]) => mockAddToCommonCounter(...(args as [])),
  removeOne: (...args: unknown[]) => mockRemoveOne(...(args as [])),
  removeOneFromCommonCounter: (...args: unknown[]) =>
    mockRemoveOneFromCommonCounter(...(args as [])),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: () => () => {} }));
jest.mock('@tanstack/query-async-storage-persister', () => ({
  createAsyncStoragePersister: () => ({}),
}));

beforeEach(() => jest.clearAllMocks());

describe('envío de lo hecho sin conexión', () => {
  it('un +N guardado en el móvil conserva la hora del toque (llega como texto)', async () => {
    const tapped = '2026-11-12T09:30:00.000Z';
    await sendAddEntry({
      counterId: 'c1',
      // Así vuelve de AsyncStorage: la fecha como texto.
      input: { amount: 2, loggedAt: tapped as unknown as Date, note: null },
      common: false,
    });
    expect(mockCreateEntry).toHaveBeenCalledWith('c1', {
      amount: 2,
      loggedAt: new Date(tapped),
      note: null,
    });
  });

  it('en un común usa la función de los comunes', async () => {
    await sendAddEntry({
      counterId: 'c2',
      input: { amount: 1, loggedAt: new Date(), note: null },
      common: true,
    });
    expect(mockAddToCommonCounter).toHaveBeenCalled();
    expect(mockCreateEntry).not.toHaveBeenCalled();
    await sendRemoveOne({ counterId: 'c2', common: true });
    expect(mockRemoveOneFromCommonCounter).toHaveBeenCalledWith('c2');
  });
});
