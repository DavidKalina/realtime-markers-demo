# CheckboxGroup Components

This directory contains decoupled checkbox group components that can be used for selecting items from a list.

## Components

### CheckboxGroup (Generic)

A flexible, generic checkbox group component that can be used with any type of selectable items.

**Props:**

- `selectedItems: T[]` - Currently selected items
- `onSelectionChange: (items: T[]) => void` - Callback when selection changes
- `items: T[]` - Available items to select from
- `isLoading?: boolean` - Loading state
- `error?: string | null` - Error state
- `buttonText?: string` - Text for the trigger button
- `modalTitle?: string` - Title for the modal
- `emptyMessage?: string` - Message when no items are available
- `loadingMessage?: string` - Message shown while loading
- `errorMessage?: string` - Message shown on error
- `renderItem?: (item: T, isSelected: boolean, onToggle: () => void) => React.ReactElement` - Custom item renderer

**Example:**

```tsx
import { CheckboxGroup, SelectableItem } from "@/components/CheckboxGroup";

interface MyItem extends SelectableItem {
  name: string;
  description: string;
}

const MyComponent = () => {
  const [selectedItems, setSelectedItems] = useState<MyItem[]>([]);
  const items: MyItem[] = [
    { id: "1", name: "Item 1", description: "Description 1" },
    { id: "2", name: "Item 2", description: "Description 2" },
  ];

  return (
    <CheckboxGroup
      selectedItems={selectedItems}
      onSelectionChange={setSelectedItems}
      items={items}
      buttonText="Select Items"
      modalTitle="Choose Items"
    />
  );
};
```

### FriendCheckboxGroup (Specialized)

A specialized component for selecting friends, built on top of the generic CheckboxGroup.

**Props:**

- `selectedFriends: FriendWithDetails[]` - Currently selected friends
- `onSelectionChange: (friends: FriendWithDetails[]) => void` - Callback when selection changes
- `buttonText?: string` - Text for the trigger button

**Example:**

```tsx
import { FriendCheckboxGroup } from "@/components/CheckboxGroup";

const MyComponent = () => {
  const [selectedFriends, setSelectedFriends] = useState<FriendWithDetails[]>(
    [],
  );

  return (
    <FriendCheckboxGroup
      selectedFriends={selectedFriends}
      onSelectionChange={setSelectedFriends}
      buttonText="Select Friends"
    />
  );
};
```

## Benefits of Decoupling

1. **Reusability**: The generic `CheckboxGroup` can be used for any type of selectable items
2. **Flexibility**: Custom item rendering and customizable messages
3. **Separation of Concerns**: Data fetching is separated from UI logic
4. **Type Safety**: Full TypeScript support with generic types
5. **Maintainability**: Easier to test and maintain individual components

## Migration from Old Component

If you were using the old `CheckboxGroup` component that was tightly coupled to friends:

**Before:**

```tsx
<CheckboxGroup
  selectedFriends={selectedFriends}
  onSelectionChange={setSelectedFriends}
  buttonText="Select Friends"
/>
```

**After:**

```tsx
<FriendCheckboxGroup
  selectedFriends={selectedFriends}
  onSelectionChange={setSelectedFriends}
  buttonText="Select Friends"
/>
```

Or use the generic version with custom data:

```tsx
<CheckboxGroup
  selectedItems={selectedFriends}
  onSelectionChange={setSelectedFriends}
  items={friends}
  isLoading={isLoading}
  error={error}
  buttonText="Select Friends"
  modalTitle="Select Friends"
/>
```
