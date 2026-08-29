#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> inventory{{"pear", 5}, {"apple", 2}};
    inventory["apple"] += 3;

    for (const auto& [name, count] : inventory) {
        std::cout << name << '=' << count << '\n';
    }
}
