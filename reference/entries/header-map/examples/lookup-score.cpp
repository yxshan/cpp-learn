#include <iostream>
#include <map>
#include <string>

int main() {
    const std::map<std::string, int> scores{{"cpp", 20}};
    std::cout << scores.at("cpp") << '\n';
}
