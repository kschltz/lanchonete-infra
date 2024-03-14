import {Construct} from "constructs";
import {App, TerraformStack, TerraformVariable} from "cdktf";
import {AwsProvider, AwsProviderConfig, AwsProviderDefaultTags} from "@cdktf/provider-aws/lib/provider";
import {SecurityGroup} from "@cdktf/provider-aws/lib/security-group";
import {Vpc} from "@cdktf/provider-aws/lib/vpc";
import {EksCluster} from "@cdktf/provider-aws/lib/eks-cluster";
import {IamRole} from "@cdktf/provider-aws/lib/iam-role";
import {Subnet} from "@cdktf/provider-aws/lib/subnet";
import {IamRolePolicyAttachment} from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import {EcrRepository} from "@cdktf/provider-aws/lib/ecr-repository";

class LanchoneteStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        const AWS_ACCESS_KEY_ID = new TerraformVariable(this, "AWS_ACCESS_KEY_ID", {type: "string", sensitive: true});
        const AWS_SECRET_ACCESS_KEY = new TerraformVariable(this, "AWS_SECRET_ACCESS_KEY", {
            type: "string",
            sensitive: true
        });

        const tags: AwsProviderDefaultTags[] = [
            {
                tags: {
                    'environment': 'dev',
                },
            },
        ];
        const cfg:AwsProviderConfig = {
            defaultTags: tags,
            accessKey: AWS_ACCESS_KEY_ID.stringValue,
            secretKey: AWS_SECRET_ACCESS_KEY.stringValue,
            region: "us-east-1"
        }
        new AwsProvider(this, 'aws-provider', cfg);

        const vpc = new Vpc(this, 'eksVpc', {
            cidrBlock: '10.0.0.0/16'
        });

        console.log(cfg);

        const subnet = new Subnet(this, 'eksSubnet', {
            vpcId: vpc.id,
            cidrBlock: '10.0.1.0/24',
            availabilityZone: 'us-east-1a'
        });

        const subnet2 = new Subnet(this, 'eksSubnet2', {
            vpcId: vpc.id,
            cidrBlock: '10.0.2.0/24',
            availabilityZone: 'us-east-1b'
        });

        const securityGroup = new SecurityGroup(this, 'eksSecurityGroup', {
            vpcId: vpc.id,
            ingress: [{
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0']
            }],
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0']
            }]
        });

        const eksRole = new IamRole(this, 'eksRole', {
            assumeRolePolicy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Principal: {
                        Service: 'eks.amazonaws.com'
                    },
                    Action: 'sts:AssumeRole'
                }]
            })
        });

        new IamRolePolicyAttachment(this, 'eksRolePolicyAttachment', {
            role: eksRole.name,
            policyArn: 'arn:aws:iam::aws:policy/AmazonEKSClusterPolicy'
        });

        new EcrRepository(this, 'eksEcrRepository', {
            name: "lanchonete-api",
            forceDelete: true
        });

        new EksCluster(this, 'eksCluster', {
            name: 'my-eks-cluster',
            roleArn: eksRole.arn,
            vpcConfig: {
                subnetIds: [subnet.id, subnet2.id],
                securityGroupIds: [securityGroup.id],
                endpointPublicAccess: true,
                endpointPrivateAccess: true
            }
        });


    }
}


const app = new App();
new LanchoneteStack(app, "lanchonete-infra");
app.synth();
