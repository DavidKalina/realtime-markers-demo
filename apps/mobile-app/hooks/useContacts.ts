import { useState, useEffect, useCallback } from "react";
import * as Contacts from "expo-contacts";

interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  selected: boolean;
}

interface UseContactsReturn {
  contacts: Contact[];
  filteredContacts: Contact[];
  selectedContacts: Contact[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasPermission: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  toggleContactSelection: (id: string) => void;
  requestPermissionAgain: () => Promise<void>;
  loadMoreContacts: () => Promise<void>;
  refreshContacts: () => Promise<void>;
}

export const useContacts = (): UseContactsReturn => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageInfo, setPageInfo] = useState({
    pageSize: 50,
    currentPage: 0,
    hasMore: true,
  });

  // Process contacts data into our format
  const processContactsData = (data: Contacts.Contact[]): Contact[] => {
    const processedContacts: Contact[] = [];

    for (const contact of data) {
      if (!contact.id) continue;

      let phoneNumber: string | undefined = undefined;
      if (
        contact.phoneNumbers &&
        Array.isArray(contact.phoneNumbers) &&
        contact.phoneNumbers.length > 0 &&
        contact.phoneNumbers[0]?.number
      ) {
        phoneNumber = contact.phoneNumbers[0].number;
      }

      let email: string | undefined = undefined;
      if (
        contact.emails &&
        Array.isArray(contact.emails) &&
        contact.emails.length > 0 &&
        contact.emails[0]?.email
      ) {
        email = contact.emails[0].email;
      }

      // Only include contacts with at least one contact method
      if (phoneNumber || email) {
        processedContacts.push({
          id: contact.id,
          name: contact.name || "Unknown",
          phoneNumber,
          email,
          selected: false,
        });
      }
    }

    return processedContacts;
  };

  // Request contacts permission and fetch first page of contacts
  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    setPageInfo({
      pageSize: 50,
      currentPage: 0,
      hasMore: true,
    });

    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status === "granted") {
        setHasPermission(true);

        try {
          const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
            pageSize: pageInfo.pageSize,
            pageOffset: 0,
          });

          if (!data || data.length === 0) {
            setContacts([]);
            setFilteredContacts([]);
            setError("No contacts found on this device");
            setPageInfo((prev) => ({ ...prev, hasMore: false }));
            setLoading(false);
            return;
          }

          const processedContacts = processContactsData(data);

          setContacts(processedContacts);
          setFilteredContacts(processedContacts);
          setPageInfo((prev) => ({
            ...prev,
            currentPage: 1,
            hasMore: data.length === pageInfo.pageSize,
          }));
        } catch (contactsError) {
          console.error("Error processing contacts:", contactsError);
          setError(
            `Failed to process contacts: ${
              contactsError instanceof Error ? contactsError.message : "Unknown error"
            }`
          );
        }
      } else {
        setHasPermission(false);
        setError("Permission to access contacts was denied");
      }
    } catch (permissionErr) {
      console.error("Permission error:", permissionErr);
      setError(
        `Failed to request contacts permission: ${
          permissionErr instanceof Error ? permissionErr.message : "Unknown error"
        }`
      );
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  // Load more contacts (for pagination)
  const loadMoreContacts = useCallback(async () => {
    // Don't load more if we're already loading or there are no more contacts
    if (loadingMore || !pageInfo.hasMore || !hasPermission) return;

    setLoadingMore(true);

    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        pageSize: pageInfo.pageSize,
        pageOffset: pageInfo.currentPage * pageInfo.pageSize,
      });

      if (!data || data.length === 0) {
        setPageInfo((prev) => ({ ...prev, hasMore: false }));
        return;
      }

      const newProcessedContacts = processContactsData(data);

      // Update contacts list with new contacts
      setContacts((prevContacts) => [...prevContacts, ...newProcessedContacts]);

      // If we're not searching, also update filtered contacts
      if (searchQuery.trim() === "") {
        setFilteredContacts((prevFiltered) => [...prevFiltered, ...newProcessedContacts]);
      } else {
        // If searching, filter the new contacts and add them
        const filteredNewContacts = newProcessedContacts.filter((contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredContacts((prevFiltered) => [...prevFiltered, ...filteredNewContacts]);
      }

      // Update page info
      setPageInfo((prev) => ({
        ...prev,
        currentPage: prev.currentPage + 1,
        hasMore: data.length === prev.pageSize,
      }));
    } catch (error) {
      console.error("Error loading more contacts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [pageInfo, loadingMore, hasPermission, searchQuery]);

  // Refresh contacts
  const refreshContacts = async () => {
    setLoading(true);
    setError(null);

    // Reset pagination
    setPageInfo({
      pageSize: 50,
      currentPage: 0,
      hasMore: true,
    });

    // Clear current contacts
    setContacts([]);
    setFilteredContacts([]);

    // Fetch first page again
    await fetchContacts();

    setLoading(false);
  };

  // Initial fetch
  useEffect(() => {
    fetchContacts();
  }, []);

  // Filter contacts based on search query
  useEffect(() => {
    // Skip filtering during initial load or when loading more
    if (loading || loadingMore) return;

    if (searchQuery.trim() === "") {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter((contact) =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts, loading, loadingMore]);

  // Toggle contact selection
  const toggleContactSelection = (id: string) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) => {
        if (contact.id === id) {
          const newSelectedState = !contact.selected;
          return { ...contact, selected: newSelectedState };
        }
        return contact;
      })
    );

    // Also update filtered contacts to maintain UI consistency
    setFilteredContacts((prevFiltered) =>
      prevFiltered.map((contact) => {
        if (contact.id === id) {
          const newSelectedState = !contact.selected;

          // Update selectedContacts
          if (newSelectedState) {
            setSelectedContacts((prev) => [...prev, { ...contact, selected: true }]);
          } else {
            setSelectedContacts((prev) => prev.filter((c) => c.id !== id));
          }

          return { ...contact, selected: newSelectedState };
        }
        return contact;
      })
    );
  };

  // Request permission again if denied
  const requestPermissionAgain = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === "granted") {
      setHasPermission(true);
      setError(null);
      // Re-fetch contacts
      await fetchContacts();
    } else {
      setError("Permission to access contacts was denied");
    }
  };

  return {
    contacts,
    filteredContacts,
    selectedContacts,
    loading,
    loadingMore,
    error,
    hasPermission,
    searchQuery,
    setSearchQuery,
    toggleContactSelection,
    requestPermissionAgain,
    loadMoreContacts,
    refreshContacts,
  };
};
