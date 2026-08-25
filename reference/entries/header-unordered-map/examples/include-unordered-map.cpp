#include <iostream>
#include <string>
#include <unordered_map>

int main() {
    const std::unordered_map<std::string, int> codes{
        {"ok", 200},
        {"not-found", 404},
    };
    std::cout << codes.at("ok") << '\n';
}
