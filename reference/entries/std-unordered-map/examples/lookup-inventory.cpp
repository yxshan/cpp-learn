#include <iostream>
#include <string>
#include <unordered_map>

int main() {
    std::unordered_map<std::string, int> inventory{
        {"book", 2},
        {"pen", 5},
    };

    if (const auto found = inventory.find("pen"); found != inventory.end()) {
        std::cout << found->first << '=' << found->second << '\n';
    }
    std::cout << std::boolalpha << inventory.contains("eraser") << '\n';
}
