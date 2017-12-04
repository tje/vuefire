import test from 'ava'
import Vuefire from '../src'
import {
  db,
  tick,
  Vue
} from './helpers'

Vue.use(Vuefire)

test.beforeEach(async t => {
  t.context.collection = db.collection()
  t.context.document = t.context.collection.doc()
  t.context.vm = new Vue({
    render (h) {
      return h('ul', this.items.map(
        item => h('li', [item])
      ))
    },
    // purposely set items as null
    // but it's a good practice to set it to an empty array
    data: () => ({
      items: null,
      item: null
    }),
    firestore: {
      items: t.context.collection,
      item: t.context.document
    }
  }).$mount()
  await tick()
})

test('does nothing with no firestore', t => {
  const vm = new Vue({
    render: h => h('p', 'foo'),
    data: () => ({ items: null })
  })
  t.deepEqual(vm.items, null)
})

test('setups _firestoreUnbinds', t => {
  const vm = t.context.vm
  t.truthy(vm._firestoreUnbinds)
  t.deepEqual(Object.keys(vm._firestoreUnbinds).sort(), ['item', 'items'])
})

test('setups _firestoreUnbinds with no firestore options', t => {
  const vm = new Vue({
    render: h => h('p', 'foo'),
    data: () => ({ items: null })
  })
  t.truthy(vm._firestoreUnbinds)
  t.deepEqual(Object.keys(vm._firestoreUnbinds), [])
})

test('setups $firestoreRefs', t => {
  const vm = t.context.vm
  t.deepEqual(Object.keys(vm.$firestoreRefs).sort(), ['item', 'items'])
  t.is(vm.$firestoreRefs.item, t.context.document)
  t.is(vm.$firestoreRefs.items, t.context.collection)
})

test('clears $firestoreRefs on $destroy', t => {
  const vm = t.context.vm
  vm.$destroy()
  t.deepEqual(vm.$firestoreRefs, null)
})