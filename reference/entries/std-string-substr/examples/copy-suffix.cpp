#include <iostream>
#include <string>

int main() {
    const std::string role = "cpp-learner";
    const std::string suffix = role.substr(4);
    std::cout << "result=" << suffix << '\n';
}
