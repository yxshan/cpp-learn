#include <iostream>
#include <string>
#include <unordered_set>

int main() {
    const std::unordered_set<std::string> capabilities{"read", "write"};
    std::cout << std::boolalpha;
    std::cout << "read=" << capabilities.contains("read") << '\n';
    std::cout << "delete=" << capabilities.contains("delete") << '\n';
}
